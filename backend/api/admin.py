import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone
from pydantic import BaseModel, Field

from database import get_db
from model.models import (
    Customer, CustomerUser, DeliverySite, PackageTemplate, AddonTemplate,
    CustomerPackage, CustomerAddon, StaffUser, Order, OrderDetail, MealSection, Invoice, CustomerMealSection,
    AuditLog, PaymentRecord,
    AUDIT_ACTION_ORDER_CREATE, AUDIT_ACTION_ORDER_UPDATE, AUDIT_ACTION_ORDER_DELETE, AUDIT_ACTION_ORDER_CANCEL,
    AUDIT_ACTION_ORDER_STATUS_CHANGE, AUDIT_ACTION_CUSTOMER_UPDATE,
    AUDIT_ACTION_CUSTOMER_BLOCK, AUDIT_ACTION_CUSTOMER_UNBLOCK,
    AUDIT_ACTION_CUSTOMER_TEMP_ACCESS, AUDIT_ACTION_CUSTOMER_TEMP_ACCESS_END,
    AUDIT_ACTION_PAYMENT_CREATE, AUDIT_ACTION_PAYMENT_DELETE
)
from schema.schemas import (
    CustomerCreate, CustomerResponse, CustomerBase, DeliverySiteCreate, DeliverySiteResponse,
    StaffUserCreate, StaffUserResponse, StaffUserUpdate, PackageTemplateCreate, PackageTemplateResponse,
    CustomerPackageAssign, CustomerPackageResponse,
    AddonTemplateCreate, AddonTemplateResponse, CustomerAddonAssign, CustomerAddonResponse,
    MealSectionCreate, MealSectionResponse, CustomerMealSectionsUpdate, CustomerUpdate
)
from api.auth import get_password_hash, require_staff, require_superadmin
from api.audit_utils import write_audit_log
from api.order_rules import (
    MALAYSIA_TZ,
    MONEY_EPSILON,
    ensure_aware_utc,
    calculate_customers_financials,
    malaysia_now,
    order_cutoff_window,
    sync_customer_access,
    temporary_access_expiry,
)

router = APIRouter(prefix="/admin", tags=["Admin Management"], dependencies=[Depends(require_staff)])


class OrderItemEdit(BaseModel):
    id: Optional[int] = None
    meal_section_id: int
    customer_package_id: int
    quantity: int
    remark: Optional[str] = ""

class OrderEditRequest(BaseModel):
    site_id: int
    delivery_date: date
    items: List[OrderItemEdit]
    reason: str = Field(min_length=3, max_length=500)
    expected_order_version: Optional[int] = None


class AdminOrderCreateRequest(BaseModel):
    customer_id: int
    site_id: int
    delivery_date: date
    items: List[OrderItemEdit]
    reason: str = Field(min_length=3, max_length=500)


class OrderStatusChangeRequest(BaseModel):
    status: str
    reason: str = Field(min_length=3, max_length=500)
    expected_order_version: Optional[int] = None


class AdminCancelOrderRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    expected_order_version: Optional[int] = None


class CustomerAccessRequest(BaseModel):
    action: str  # block | unblock | temporary_open | end_temporary
    reason: str = Field(min_length=3, max_length=500)


def _operator(auth: dict) -> tuple[str, str]:
    return auth.get("name") or auth.get("sub") or "后台管理员", auth.get("role") or "staff"


def _required_reason(value: str) -> str:
    reason = value.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="操作原因至少需要 3 个非空白字符")
    return reason


def _format_audit_time(value: datetime | None) -> str | None:
    aware = ensure_aware_utc(value)
    return aware.astimezone(MALAYSIA_TZ).strftime("%Y-%m-%d %H:%M:%S") if aware else None


def _decorate_customer_access(customer: Customer, access: dict) -> None:
    customer.effective_is_blocked = access["effective_is_blocked"]
    customer.temporary_access_active = access["temporary_access_active"]
    customer.overdue_amount = access["overdue_amount"]
    customer.outstanding_balance = access["outstanding_balance"]
    customer.oldest_overdue_due_date = access["oldest_overdue_due_date"]
    customer.max_order_delivery_date = access["max_order_delivery_date"]

# --- 1. 客户档案管理 ---
@router.post("/customers", response_model=CustomerResponse)
def create_customer(req: CustomerCreate, db: Session = Depends(get_db)):
    existing_user = db.query(CustomerUser).filter(CustomerUser.username == req.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="订餐员用户名已存在")
    if req.is_blocked:
        raise HTTPException(status_code=400, detail="请先创建客户，再通过账户限制操作冻结并填写原因")

    customer = Customer(
        company_name=req.company_name,
        company_reg_no=req.company_reg_no,
        phone=req.phone,
        company_address=req.company_address,
        contact_name=req.contact_name,
        bank_account_no=req.bank_account_no,
        bank_name=req.bank_name,
        email=req.email,
        tax_number=req.tax_number,
        billing_cycle=req.billing_cycle,
        is_blocked=False
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    c_user = CustomerUser(
        customer_id=customer.id,
        username=req.username,
        password_hash=get_password_hash(req.password),
        contact_name=req.contact_name or req.company_name
    )
    db.add(c_user)

    for site_in in req.sites:
        site = DeliverySite(
            customer_id=customer.id,
            site_name=site_in.site_name,
            address=site_in.address,
            contact_person=site_in.contact_person,
            phone=site_in.phone
        )
        db.add(site)

    db.commit()
    db.refresh(customer)
    return customer

@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(db: Session = Depends(get_db)):
    customers = (
        db.query(Customer)
        .options(selectinload(Customer.users), selectinload(Customer.sites))
        .order_by(Customer.id.desc())
        .all()
    )
    current_local = malaysia_now()
    financials = calculate_customers_financials(db, customers, current_local.date())
    for c in customers:
        access = sync_customer_access(
            db,
            c,
            now=current_local,
            financial=financials[c.id],
        )
        _decorate_customer_access(c, access)
        c.username = c.users[0].username if c.users else None
    if db.new or db.dirty:
        db.commit()
    return customers

@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, req: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    update_data = req.dict(exclude_unset=True)
    username = update_data.pop("username", None)
    password = update_data.pop("password", None)
    if "is_blocked" in update_data and bool(update_data["is_blocked"]) != bool(customer.is_blocked):
        raise HTTPException(status_code=400, detail="请使用账户限制操作并填写原因，不能在普通资料编辑中更改冻结状态")
    update_data.pop("is_blocked", None)

    if username or password:
        c_user = db.query(CustomerUser).filter(CustomerUser.customer_id == customer_id).first()
        if c_user:
            if username:
                existing = db.query(CustomerUser).filter(CustomerUser.username == username, CustomerUser.id != c_user.id).first()
                if existing:
                    raise HTTPException(status_code=400, detail="订餐员用户名已存在")
                c_user.username = username
            if password:
                c_user.password_hash = get_password_hash(password)
        elif username and password:
            new_user = CustomerUser(
                customer_id=customer_id,
                username=username,
                password_hash=get_password_hash(password),
                contact_name=customer.contact_name or customer.company_name
            )
            db.add(new_user)

    for key, value in update_data.items():
        if hasattr(customer, key):
            setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    customer.username = customer.users[0].username if customer.users else None
    access = sync_customer_access(db, customer)
    _decorate_customer_access(customer, access)
    db.commit()
    return customer


@router.put("/customers/{customer_id}/order-access")
def update_customer_order_access(
    customer_id: int,
    req: CustomerAccessRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).with_for_update().first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    access = sync_customer_access(db, customer)
    operator_name, operator_role = _operator(auth)
    action = req.action.strip().lower()
    reason = _required_reason(req.reason)
    now_local = malaysia_now()
    now_utc = now_local.astimezone(timezone.utc)
    before = {
        "is_blocked": bool(customer.is_blocked),
        "block_source": customer.block_source,
        "block_reason": customer.block_reason,
        "temporary_access_until": customer.temporary_access_until.isoformat() if customer.temporary_access_until else None,
    }

    if action == "block":
        customer.is_blocked = True
        customer.block_source = "manual"
        customer.block_reason = reason
        customer.blocked_at = now_utc
        customer.temporary_access_started_at = None
        customer.temporary_access_until = None
        customer.temporary_access_reason = None
        audit_action = AUDIT_ACTION_CUSTOMER_BLOCK
        description = f"手动冻结客户 {customer.company_name} 的下单权限"
    elif action == "unblock":
        if access["overdue_amount"] > MONEY_EPSILON:
            raise HTTPException(status_code=409, detail="客户仍有到期欠款，不能永久解冻；请使用临时开通两天")
        customer.is_blocked = False
        customer.block_source = None
        customer.block_reason = None
        customer.temporary_access_started_at = None
        customer.temporary_access_until = None
        customer.temporary_access_reason = None
        audit_action = AUDIT_ACTION_CUSTOMER_UNBLOCK
        description = f"解除客户 {customer.company_name} 的下单冻结"
    elif action == "temporary_open":
        if not customer.is_blocked and access["overdue_amount"] <= MONEY_EPSILON:
            raise HTTPException(status_code=409, detail="客户当前没有冻结，无需临时开通")
        if not customer.is_blocked:
            customer.is_blocked = True
            customer.block_source = "overdue"
            customer.blocked_at = now_utc
        customer.temporary_access_started_at = now_utc
        customer.temporary_access_until = temporary_access_expiry(now_local).astimezone(timezone.utc)
        customer.temporary_access_reason = reason
        audit_action = AUDIT_ACTION_CUSTOMER_TEMP_ACCESS
        description = f"为客户 {customer.company_name} 临时开放两个日历日的下单权限"
    elif action == "end_temporary":
        if not access["temporary_access_active"]:
            raise HTTPException(status_code=409, detail="客户当前没有生效中的临时权限")
        customer.temporary_access_until = now_utc - timedelta(seconds=1)
        audit_action = AUDIT_ACTION_CUSTOMER_TEMP_ACCESS_END
        description = f"提前结束客户 {customer.company_name} 的临时下单权限"
    else:
        raise HTTPException(status_code=400, detail="不支持的账户限制操作")

    customer.restriction_updated_by = operator_name
    after = {
        "is_blocked": bool(customer.is_blocked),
        "block_source": customer.block_source,
        "block_reason": customer.block_reason,
        "temporary_access_started_at": customer.temporary_access_started_at.isoformat() if customer.temporary_access_started_at else None,
        "temporary_access_until": customer.temporary_access_until.isoformat() if customer.temporary_access_until else None,
        "temporary_access_reason": customer.temporary_access_reason,
    }
    write_audit_log(
        db=db,
        action_type=audit_action,
        description=description,
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=customer.id,
        target_label=customer.company_name,
        extra_data={
            "reason": reason,
            "before": before,
            "after": after,
            "overdue_amount": access["overdue_amount"],
            "outstanding_balance": access["outstanding_balance"],
        },
    )
    db.commit()
    db.refresh(customer)
    current_access = sync_customer_access(db, customer)
    db.commit()
    return {
        "message": description,
        "customer_id": customer.id,
        "effective_is_blocked": current_access["effective_is_blocked"],
        "temporary_access_active": current_access["temporary_access_active"],
        "temporary_access_until": current_access["temporary_access_until"],
        "overdue_amount": current_access["overdue_amount"],
    }


@router.get("/customers/{customer_id}/restriction-history")
def get_customer_restriction_history(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    action_types = [
        AUDIT_ACTION_CUSTOMER_BLOCK,
        AUDIT_ACTION_CUSTOMER_UNBLOCK,
        AUDIT_ACTION_CUSTOMER_TEMP_ACCESS,
        AUDIT_ACTION_CUSTOMER_TEMP_ACCESS_END,
    ]
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.target_id == customer_id, AuditLog.action_type.in_(action_types))
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    results = []
    for log in logs:
        try:
            extra = json.loads(log.extra_data) if log.extra_data else {}
        except (TypeError, json.JSONDecodeError):
            extra = {}
        results.append({
            "id": log.id,
            "action_type": log.action_type,
            "description": log.description,
            "operator_name": log.operator_name,
            "operator_role": log.operator_role,
            "reason": extra.get("reason") or extra.get("previous_reason") or "",
            "temporary_access_until": (extra.get("after") or {}).get("temporary_access_until"),
            "extra_data": log.extra_data,
            "created_at": _format_audit_time(log.created_at),
        })
    return results

@router.post("/customers/{customer_id}/sites", response_model=DeliverySiteResponse)
def add_delivery_site(customer_id: int, site_in: DeliverySiteCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    site = DeliverySite(
        customer_id=customer_id,
        site_name=site_in.site_name,
        address=site_in.address,
        contact_person=site_in.contact_person,
        phone=site_in.phone
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site

@router.put("/customers/sites/{site_id}", response_model=DeliverySiteResponse)
def update_delivery_site(site_id: int, site_in: DeliverySiteCreate, db: Session = Depends(get_db)):
    site = db.query(DeliverySite).filter(DeliverySite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="分点不存在")

    site.site_name = site_in.site_name
    site.address = site_in.address
    if site_in.contact_person is not None:
        site.contact_person = site_in.contact_person
    if site_in.phone is not None:
        site.phone = site_in.phone

    db.commit()
    db.refresh(site)
    return site

@router.delete("/customers/sites/{site_id}")
def delete_delivery_site(site_id: int, db: Session = Depends(get_db)):
    site = db.query(DeliverySite).filter(DeliverySite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="分点不存在")

    db.delete(site)
    db.commit()
    return {"message": "分点已成功删除"}

# --- 2. 内部员工账号管理 (仅 Superadmin 可访问) ---
@router.post("/staff", response_model=StaffUserResponse, dependencies=[Depends(require_superadmin)])
def create_staff(req: StaffUserCreate, db: Session = Depends(get_db)):
    existing = db.query(StaffUser).filter(StaffUser.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="员工用户名已存在")

    staff = StaffUser(
        username=req.username,
        password_hash=get_password_hash(req.password),
        full_name=req.full_name,
        role=req.role,
        is_active=req.is_active
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff

@router.get("/staff", response_model=List[StaffUserResponse], dependencies=[Depends(require_superadmin)])
def list_staff(db: Session = Depends(get_db)):
    return db.query(StaffUser).all()

@router.put("/staff/{staff_id}", response_model=StaffUserResponse, dependencies=[Depends(require_superadmin)])
def update_staff(staff_id: int, req: StaffUserUpdate, db: Session = Depends(get_db)):
    staff = db.query(StaffUser).filter(StaffUser.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="员工不存在")
    
    update_data = req.dict(exclude_unset=True)
    if "username" in update_data and update_data["username"] != staff.username:
        existing = db.query(StaffUser).filter(StaffUser.username == update_data["username"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="用户名已存在")
            
    if "password" in update_data:
        if update_data["password"]:
            staff.password_hash = get_password_hash(update_data["password"])
        del update_data["password"]

    for key, value in update_data.items():
        setattr(staff, key, value)
        
    db.commit()
    db.refresh(staff)
    return staff

@router.delete("/staff/{staff_id}", dependencies=[Depends(require_superadmin)])
def delete_staff(staff_id: int, db: Session = Depends(get_db)):

    staff = db.query(StaffUser).filter(StaffUser.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="员工不存在")
    db.delete(staff)
    db.commit()
    return {"message": "删除成功"}

# --- 3. 菜单与套餐库管理 ---
@router.post("/packages", response_model=PackageTemplateResponse)
def create_package_template(req: PackageTemplateCreate, db: Session = Depends(get_db)):
    template = PackageTemplate(**req.dict())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.get("/packages", response_model=List[PackageTemplateResponse])
def list_package_templates(db: Session = Depends(get_db)):
    return db.query(PackageTemplate).all()

@router.put("/packages/{package_id}", response_model=PackageTemplateResponse)
def update_package_template(package_id: int, req: PackageTemplateCreate, db: Session = Depends(get_db)):
    template = db.query(PackageTemplate).filter(PackageTemplate.id == package_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="套餐模板不存在")
    
    for key, value in req.dict().items():
        setattr(template, key, value)
        
    db.commit()
    db.refresh(template)
    return template

@router.delete("/packages/{package_id}")
def delete_package_template(package_id: int, db: Session = Depends(get_db)):
    template = db.query(PackageTemplate).filter(PackageTemplate.id == package_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="套餐模板不存在")
    
    in_use = db.query(CustomerPackage).filter(CustomerPackage.package_template_id == package_id, CustomerPackage.is_active == True).first()
    if in_use:
        raise HTTPException(status_code=400, detail="该套餐模板已被分配给顾客，请先在顾客专属菜单库中将其删除。")
        
    try:
        db.delete(template)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="该套餐模板已存在关联订单历史，无法删除。")
        
    return {"detail": "删除成功"}

@router.post("/customers/{customer_id}/packages", response_model=CustomerPackageResponse)
def assign_package_to_customer(customer_id: int, req: CustomerPackageAssign, db: Session = Depends(get_db)):
    template = db.query(PackageTemplate).filter(PackageTemplate.id == req.package_template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="套餐模板不存在")

    cp = db.query(CustomerPackage).filter(
        CustomerPackage.customer_id == customer_id,
        CustomerPackage.package_template_id == req.package_template_id
    ).first()
    if cp:
        cp.is_active = True
        cp.agreement_price = req.agreement_price
    else:
        cp = CustomerPackage(
            customer_id=customer_id,
            package_template_id=req.package_template_id,
            agreement_price=req.agreement_price
        )
        db.add(cp)
    db.commit()
    db.refresh(cp)

    return CustomerPackageResponse(
        id=cp.id,
        customer_id=cp.customer_id,
        package_template_id=cp.package_template_id,
        agreement_price=cp.agreement_price,
        template_name=template.name,
        category=template.category
    )

@router.delete("/customers/{customer_id}/packages/{cp_id}")
def delete_customer_package(customer_id: int, cp_id: int, db: Session = Depends(get_db)):
    cp = db.query(CustomerPackage).filter(
        CustomerPackage.id == cp_id,
        CustomerPackage.customer_id == customer_id
    ).first()
    if not cp:
        raise HTTPException(status_code=404, detail="该专属套餐不存在")
    
    # Soft delete to preserve order history
    cp.is_active = False
    db.commit()
    return {"detail": "删除成功"}

@router.get("/customers/{customer_id}/packages", response_model=List[CustomerPackageResponse])
def get_customer_assigned_packages(customer_id: int, db: Session = Depends(get_db)):
    cps = db.query(CustomerPackage).filter(CustomerPackage.customer_id == customer_id, CustomerPackage.is_active == True).all()
    result = []
    for cp in cps:
        result.append(CustomerPackageResponse(
            id=cp.id,
            customer_id=cp.customer_id,
            package_template_id=cp.package_template_id,
            agreement_price=cp.agreement_price,
            template_name=cp.template.name,
            category=cp.template.category,
            is_shown_to_customer=cp.is_shown_to_customer  # NOTE: 将显示状态包含在返回中
        ))
    return result

@router.patch("/customers/{customer_id}/packages/{cp_id}/toggle-visibility", response_model=CustomerPackageResponse)
def toggle_package_visibility(customer_id: int, cp_id: int, db: Session = Depends(get_db)):
    """
    切换该客户专属套餐在下单页面的显示状态
    勾选 = 下单页可以选择，取消勾选 = 下单页隐藏
    """
    cp = db.query(CustomerPackage).filter(
        CustomerPackage.id == cp_id,
        CustomerPackage.customer_id == customer_id,
        CustomerPackage.is_active == True
    ).first()
    if not cp:
        raise HTTPException(status_code=404, detail="该专属套餐不存在")

    cp.is_shown_to_customer = not cp.is_shown_to_customer
    db.commit()
    db.refresh(cp)

    return CustomerPackageResponse(
        id=cp.id,
        customer_id=cp.customer_id,
        package_template_id=cp.package_template_id,
        agreement_price=cp.agreement_price,
        template_name=cp.template.name,
        category=cp.template.category,
        is_shown_to_customer=cp.is_shown_to_customer
    )

# --- 4. 每日订单状态与后台数据编辑 API ---
@router.post("/orders")
def create_order_by_admin(
    req: AdminOrderCreateRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    reason = _required_reason(req.reason)
    customer = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    site = db.query(DeliverySite).filter(
        DeliverySite.id == req.site_id,
        DeliverySite.customer_id == req.customer_id,
    ).first()
    if not site:
        raise HTTPException(status_code=400, detail="配送地点不存在或不属于该客户")
    if not any(item.quantity > 0 for item in req.items):
        raise HTTPException(status_code=400, detail="请至少加入一项数量大于 0 的餐品")
    existing = db.query(Order).filter(
        Order.customer_id == req.customer_id,
        Order.delivery_site_id == req.site_id,
        Order.delivery_date == req.delivery_date,
        Order.status != "cancelled",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="该客户、地点及配送日期已有订单，请改用编辑功能")

    assigned_rows = db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == req.customer_id).all()
    assigned_sections = {row.meal_section_id: row.meal_section for row in assigned_rows}
    package_ids = {item.customer_package_id for item in req.items if item.quantity > 0}
    packages = db.query(CustomerPackage).filter(
        CustomerPackage.id.in_(package_ids),
        CustomerPackage.customer_id == req.customer_id,
        CustomerPackage.is_active == True,
    ).all()
    package_map = {row.id: row for row in packages}
    if len(package_map) != len(package_ids):
        raise HTTPException(status_code=400, detail="订单包含未分配给该客户的套餐")

    window = order_cutoff_window(req.delivery_date)
    late_override = window["phase"] != "open" or window["is_delivery_day_or_past"]
    order = Order(
        customer_id=req.customer_id,
        delivery_site_id=req.site_id,
        delivery_date=req.delivery_date,
        status="submitted",
        version=1,
        updated_at=datetime.now(timezone.utc),
        is_late_override=late_override,
    )
    db.add(order)
    db.flush()

    snapshot = []
    for item in req.items:
        if item.quantity <= 0:
            continue
        section = assigned_sections.get(item.meal_section_id)
        if not section:
            raise HTTPException(status_code=400, detail=f"餐次 ID {item.meal_section_id} 未向该客户开放")
        cp = package_map[item.customer_package_id]
        allowed_categories = {value.strip() for value in (section.allowed_categories or "").split(",") if value.strip()}
        if allowed_categories and cp.template.category not in allowed_categories:
            raise HTTPException(status_code=400, detail="所选套餐不属于该餐次允许的分类")
        db.add(OrderDetail(
            order_id=order.id,
            meal_section_id=item.meal_section_id,
            customer_package_id=cp.id,
            quantity=item.quantity,
            final_unit_price=cp.agreement_price,
            remark=item.remark or "",
        ))
        snapshot.append({
            "meal_section_id": item.meal_section_id,
            "customer_package_id": cp.id,
            "quantity": item.quantity,
            "remark": item.remark or "",
        })

    operator_name, operator_role = _operator(auth)
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_ORDER_CREATE,
        description=f"后台代客户创建订单 #{order.id}",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=order.id,
        target_label=f"{customer.company_name} | {req.delivery_date}",
        extra_data={
            "reason": reason,
            "after": snapshot,
            "admin_override": True,
            "late_override": late_override,
            "cutoff_at": window["cutoff_at"],
        },
    )
    db.commit()
    return {"message": "后台代客下单成功", "order_id": order.id, "late_override": late_override, "version": order.version}


@router.get("/all-orders")
def get_all_orders(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if start_date:
        query = query.filter(Order.delivery_date >= start_date)
    if end_date:
        query = query.filter(Order.delivery_date <= end_date)
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)

    orders = query.order_by(Order.delivery_date.desc()).all()
    results = []

    for o in orders:
        details_list = []
        total_portions = 0
        total_price = 0.0

        for d in o.details:
            pkg_name = d.customer_package.template.name if d.customer_package else "未知"
            meal_name = d.meal_section.name if d.meal_section else ""
            total_portions += d.quantity
            total_price += (d.quantity * d.final_unit_price)

            details_list.append({
                "id": d.id,
                "meal_section_id": d.meal_section_id,
                "meal_section": meal_name,
                "customer_package_id": d.customer_package_id,
                "package_name": pkg_name,
                "quantity": d.quantity,
                "unit_price": d.final_unit_price,
                "subtotal": d.quantity * d.final_unit_price,
                "remark": d.remark
            })

        results.append({
            "id": o.id,
            "customer_id": o.customer_id,
            "company_name": o.customer.company_name,
            "site_id": o.delivery_site_id,
            "site_name": o.site.site_name if o.site else "",
            "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
            "status": o.status,
            "version": o.version or 1,
            "is_late_override": bool(o.is_late_override),
            "total_portions": total_portions,
            "total_price": total_price,
            "details": details_list,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return results

@router.put("/orders/{order_id}")
def edit_order_by_admin(
    order_id: int,
    req: OrderEditRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    reason = _required_reason(req.reason)
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if req.expected_order_version is not None and order.version != req.expected_order_version:
        raise HTTPException(status_code=409, detail="订单已被其他人员修改，请刷新后重试")
    if order.invoice_id is not None or order.status in {"billed", "paid"}:
        raise HTTPException(status_code=409, detail="订单已经核账或付款，请先在账单管理中作废/解除关联后再修改")
    if not any(item.quantity > 0 for item in req.items):
        raise HTTPException(status_code=400, detail="订单至少保留一项数量大于 0 的餐品；整单取消请使用取消功能")
    site = db.query(DeliverySite).filter(
        DeliverySite.id == req.site_id,
        DeliverySite.customer_id == order.customer_id,
    ).first()
    if not site:
        raise HTTPException(status_code=400, detail="配送地点不存在或不属于该客户")
    assigned_rows = db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == order.customer_id).all()
    assigned_sections = {row.meal_section_id: row.meal_section for row in assigned_rows}

    operator_name, operator_role = _operator(auth)

    # NOTE: 在修改前捕获旧值，用于生成变更 diff
    old_delivery_date = str(order.delivery_date)
    old_site_id = order.delivery_site_id
    old_site = db.query(DeliverySite).filter(DeliverySite.id == old_site_id).first()
    old_details = [{
        "meal_section_id": detail.meal_section_id,
        "customer_package_id": detail.customer_package_id,
        "quantity": detail.quantity,
        "remark": detail.remark or "",
    } for detail in order.details]

    order_label = f"{order.customer.company_name} | {order.delivery_date}"

    order.delivery_site_id = req.site_id
    order.delivery_date = req.delivery_date

    db.query(OrderDetail).filter(OrderDetail.order_id == order_id).delete()

    new_details = []
    for item in req.items:
        if item.quantity > 0:
            section = assigned_sections.get(item.meal_section_id)
            if not section:
                raise HTTPException(status_code=400, detail=f"餐次 ID {item.meal_section_id} 未向该客户开放")
            cp = db.query(CustomerPackage).filter(
                CustomerPackage.id == item.customer_package_id,
                CustomerPackage.customer_id == order.customer_id,
                CustomerPackage.is_active == True,
            ).first()
            if not cp:
                raise HTTPException(status_code=400, detail="订单包含未分配给该客户的套餐")
            allowed_categories = {value.strip() for value in (section.allowed_categories or "").split(",") if value.strip()}
            if allowed_categories and cp.template.category not in allowed_categories:
                raise HTTPException(status_code=400, detail="所选套餐不属于该餐次允许的分类")

            db.add(OrderDetail(
                order_id=order_id,
                meal_section_id=item.meal_section_id,
                customer_package_id=item.customer_package_id,
                quantity=item.quantity,
                final_unit_price=cp.agreement_price,
                remark=item.remark or ""
            ))
            new_details.append({
                "meal_section_id": item.meal_section_id,
                "customer_package_id": item.customer_package_id,
                "quantity": item.quantity,
                "remark": item.remark or "",
            })

    # NOTE: 构建变更 diff 列表，供前端以 "旧值 → 新值" 格式渲染
    changes = []
    new_delivery_date = str(req.delivery_date)
    if old_delivery_date != new_delivery_date:
        changes.append({"field": "配送日期", "old": old_delivery_date, "new": new_delivery_date})

    if old_site_id != req.site_id:
        new_site = db.query(DeliverySite).filter(DeliverySite.id == req.site_id).first()
        changes.append({
            "field": "送餐地址",
            "old": old_site.site_name if old_site else str(old_site_id),
            "new": new_site.site_name if new_site else str(req.site_id)
        })

    # 菜品明细始终记录为已变更（每次管理员编辑都会重建明细）
    changes.append({"field": "菜品明细", "old": "details_changed", "new": "details_changed"})
    window = order_cutoff_window(req.delivery_date)
    late_override = window["phase"] != "open" or window["is_delivery_day_or_past"]
    order.is_late_override = bool(order.is_late_override or late_override)
    order.version = (order.version or 1) + 1
    order.updated_at = datetime.now(timezone.utc)

    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_ORDER_UPDATE,
        description=f"修改了订单 #{order_id} 的信息",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=order_id,
        target_label=order_label,
        extra_data={
            "reason": reason,
            "changes": changes,
            "before": old_details,
            "after": new_details,
            "admin_override": True,
            "late_override": late_override,
            "cutoff_at": window["cutoff_at"],
        }
    )

    db.commit()
    return {"message": "订单修改成功", "order_id": order.id, "version": order.version, "late_override": late_override}

@router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    req: OrderStatusChangeRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    reason = _required_reason(req.reason)
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if req.expected_order_version is not None and order.version != req.expected_order_version:
        raise HTTPException(status_code=409, detail="订单已被其他人员修改，请刷新后重试")
    new_status = req.status.strip().lower()
    allowed_statuses = {"submitted", "confirmed", "in_production", "delivered", "billed", "paid", "cancelled"}
    if new_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="不支持的订单状态")
    if order.invoice_id is not None and new_status not in {"billed", "paid"}:
        raise HTTPException(status_code=409, detail="订单已关联账单，请先在账单管理中解除关联后再更改为其他状态")
    operator_name, operator_role = _operator(auth)

    old_status = order.status
    order_label = f"{order.customer.company_name} | {order.delivery_date}"

    order.status = new_status
    order.version = (order.version or 1) + 1
    order.updated_at = datetime.now(timezone.utc)
    window = order_cutoff_window(order.delivery_date)
    late_override = window["phase"] != "open" or window["is_delivery_day_or_past"]
    order.is_late_override = bool(order.is_late_override or late_override)

    # NOTE: 写入状态变更审计日志（changes 格式与订单编辑统一）
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_ORDER_STATUS_CHANGE,
        description=f"将订单 #{order_id} 的状态从 \"{old_status}\" 变更为 \"{new_status}\"",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=order_id,
        target_label=order_label,
        extra_data={
            "reason": reason,
            "changes": [{"field": "订单状态", "old": old_status, "new": new_status}],
            "admin_override": True,
            "late_override": late_override,
            "cutoff_at": window["cutoff_at"],
        }
    )

    db.commit()
    return {"message": "状态修改成功", "order_id": order_id, "new_status": new_status, "version": order.version}

@router.post("/orders/{order_id}/cancel")
def cancel_order_by_admin(
    order_id: int,
    req: AdminCancelOrderRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    reason = _required_reason(req.reason)
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if req.expected_order_version is not None and order.version != req.expected_order_version:
        raise HTTPException(status_code=409, detail="订单已被其他人员修改，请刷新后重试")
    if order.invoice_id is not None or order.status in {"billed", "paid"}:
        raise HTTPException(status_code=409, detail="订单已经核账或付款，请先在账单管理中作废/解除关联后再取消")
    operator_name, operator_role = _operator(auth)

    order_label = f"{order.customer.company_name} | {order.delivery_date}"
    order_id_snapshot = order.id
    old_status = order.status
    old_details = [{
        "meal_section_id": detail.meal_section_id,
        "customer_package_id": detail.customer_package_id,
        "quantity": detail.quantity,
        "remark": detail.remark or "",
    } for detail in order.details]
    order.status = "cancelled"
    order.version = (order.version or 1) + 1
    order.updated_at = datetime.now(timezone.utc)
    window = order_cutoff_window(order.delivery_date)
    late_override = window["phase"] != "open" or window["is_delivery_day_or_past"]
    order.is_late_override = bool(order.is_late_override or late_override)

    # NOTE: 订单采用软取消，保留原记录及明细；审计日志与状态变更同一事务提交。
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_ORDER_CANCEL,
        description=f"后台取消了订单 #{order_id_snapshot}",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=order_id_snapshot,
        target_label=order_label,
        extra_data={
            "reason": reason,
            "changes": [{"field": "订单状态", "old": old_status, "new": "cancelled"}],
            "before": old_details,
            "admin_override": True,
            "late_override": late_override,
            "cutoff_at": window["cutoff_at"],
        }
    )
    db.commit()
    return {"message": "订单已取消并保留审计记录", "order_id": order_id, "version": order.version}

# ============================================================
# 5. 订单操作记录查询 API
# ============================================================

@router.get("/orders/{order_id}/audit-logs")
def get_order_audit_logs(order_id: int, db: Session = Depends(get_db)):
    """
    获取指定订单的所有操作历史记录，按时间倒序
    """
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.target_id == order_id)
        .filter(AuditLog.action_type.in_([
            AUDIT_ACTION_ORDER_CREATE,
            AUDIT_ACTION_ORDER_UPDATE,
            AUDIT_ACTION_ORDER_DELETE,
            AUDIT_ACTION_ORDER_CANCEL,
            AUDIT_ACTION_ORDER_STATUS_CHANGE,
        ]))
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "description": log.description,
            "operator_name": log.operator_name,
            "operator_role": log.operator_role,
            "extra_data": log.extra_data,
            "created_at": _format_audit_time(log.created_at),
        }
        for log in logs
    ]


# --- 全局审计日志列表（供 superadmin 审计日志全页使用）---
@router.get("/audit-logs", dependencies=[Depends(require_superadmin)])
def list_audit_logs(
    action_type: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
    db: Session = Depends(get_db)
):
    """
    分页查询所有系统审计日志，支持按操作类型和关键词过滤
    """
    query = db.query(AuditLog)

    if action_type:
        query = query.filter(AuditLog.action_type == action_type)

    if keyword:
        # NOTE: 模糊搜索描述、操作人、目标标签
        like_pattern = f"%{keyword}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                AuditLog.description.like(like_pattern),
                AuditLog.operator_name.like(like_pattern),
                AuditLog.target_label.like(like_pattern),
            )
        )

    total = query.count()
    offset = (page - 1) * page_size
    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size).all()

    items = [
        {
            "id": log.id,
            "action_type": log.action_type,
            "target_id": log.target_id,
            "target_label": log.target_label,
            "description": log.description,
            "operator_name": log.operator_name,
            "operator_role": log.operator_role,
            "extra_data": log.extra_data,
            "created_at": _format_audit_time(log.created_at),
        }
        for log in logs
    ]

    return {"total": total, "page": page, "page_size": page_size, "items": items}


# --- 6. 订单日历与配餐/送货单打印 API ---
@router.get("/calendar-summary")
def get_calendar_summary(start_date: date, end_date: date, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.delivery_date >= start_date, Order.delivery_date <= end_date).all()
    calendar_map = {}
    for order in orders:
        d_str = order.delivery_date.strftime("%Y-%m-%d")
        if d_str not in calendar_map:
            calendar_map[d_str] = {}

        c_name = order.customer.company_name
        if c_name not in calendar_map[d_str]:
            calendar_map[d_str][c_name] = {
                "customer_id": order.customer_id,
                "company_name": c_name,
                "total_portions": 0,
                "sites": []
            }

        order_portions = sum(d.quantity for d in order.details)
        calendar_map[d_str][c_name]["total_portions"] += order_portions
        calendar_map[d_str][c_name]["sites"].append({
            "site_name": order.site.site_name,
            "portions": order_portions,
            "status": order.status
        })

    return calendar_map

MEAL_ORDER_MAP = {
    "早餐": 1,
    "早班午餐": 2,
    "早班晚餐": 3,
    "客户/顾问加餐饭盒": 4,
    "夜班餐食 10pm Buffet": 5,
    "夜班餐食 3am 宵夜": 6
}

@router.get("/print-daily-summary")
def get_daily_print_summary(
    target_date: date,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order).filter(Order.delivery_date == target_date)
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)

    orders = query.all()
    kitchen_production_total = {}
    delivery_breakdown = []

    target_customer_info = None
    if customer_id:
        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if cust:
            target_customer_info = {
                "company_name": cust.company_name,
                "company_reg_no": cust.company_reg_no,
                "contact_name": cust.contact_name,
                "phone": cust.phone,
                "address": cust.company_address
            }

    for order in orders:
        for detail in order.details:
            pkg_name = detail.customer_package.template.name if detail.customer_package else (
                detail.customer_addon.template.name if detail.customer_addon else "未知"
            )
            meal_name = detail.meal_section.name

            key = f"{pkg_name} ({meal_name})"
            kitchen_production_total[key] = kitchen_production_total.get(key, 0) + detail.quantity

            delivery_breakdown.append({
                "company_name": order.customer.company_name,
                "site_name": order.site.site_name,
                "meal_section": meal_name,
                "package_name": pkg_name,
                "quantity": detail.quantity,
                "remark": detail.remark,
                "address": order.site.address,
                "sort_score": MEAL_ORDER_MAP.get(meal_name, 99)
            })

    delivery_breakdown.sort(key=lambda x: (x["company_name"], x["site_name"], x["sort_score"]))

    return {
        "target_date": target_date.strftime("%Y-%m-%d"),
        "customer_info": target_customer_info,
        "kitchen_totals": kitchen_production_total,
        "delivery_breakdown": delivery_breakdown
    }

# --- 6. 数据看板 Dashboard API ---
@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    current_local = malaysia_now()
    today = current_local.date()
    today_orders_count, today_portions = (
        db.query(
            func.count(func.distinct(Order.id)),
            func.coalesce(func.sum(OrderDetail.quantity), 0),
        )
        .select_from(Order)
        .outerjoin(OrderDetail, OrderDetail.order_id == Order.id)
        .filter(Order.delivery_date == today)
        .one()
    )

    all_customers = db.query(Customer).all()
    financials = calculate_customers_financials(db, all_customers, today)
    for customer in all_customers:
        sync_customer_access(
            db,
            customer,
            now=current_local,
            financial=financials[customer.id],
        )
    total_customers = len(all_customers)
    blocked_customers = sum(1 for customer in all_customers if customer.is_blocked)
    if db.new or db.dirty:
        db.commit()

    month_revenue = db.query(
        func.coalesce(func.sum(OrderDetail.quantity * OrderDetail.final_unit_price), 0.0)
    ).scalar()

    return {
        "today_portions": int(today_portions or 0),
        "today_orders_count": int(today_orders_count or 0),
        "total_customers": total_customers,
        "blocked_customers": blocked_customers,
        "month_revenue": float(month_revenue or 0.0),
        "today_date": today.strftime("%Y-%m-%d")
    }

# --- 7. 送货单 DO 与对账还款 API ---
class PaymentCreateRequest(BaseModel):
    customer_id: int
    payment_date: date
    amount: float
    payment_method: Optional[str] = "Bank Transfer"
    reference_no: Optional[str] = ""
    allocated_dos_text: Optional[str] = ""
    do_ids: Optional[List[int]] = None
    remark: Optional[str] = ""

def get_order_eager_options():
    return [
        joinedload(Order.customer),
        joinedload(Order.site),
        selectinload(Order.details).joinedload(OrderDetail.meal_section),
        selectinload(Order.details).joinedload(OrderDetail.customer_package).joinedload(CustomerPackage.template),
        selectinload(Order.details).joinedload(OrderDetail.customer_addon).joinedload(CustomerAddon.template),
    ]

@router.api_route("/customers/{customer_id}/unpaid-dos", methods=["GET", "OPTIONS"])
def get_customer_dos_for_payment(customer_id: int, db: Session = Depends(get_db)):
    """获取指定客户的所有送货单 DO 列表（包含金额和到期状态），用于打款核销选择"""
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="客户不存在")

    today = date.today()
    try:
        billing_cycle_days = int(str(cust.billing_cycle).replace('天', '').strip()) if cust and cust.billing_cycle else 14
        if billing_cycle_days <= 0:
            billing_cycle_days = 14
    except (ValueError, TypeError):
        billing_cycle_days = 14

    dos = db.query(Order).options(*get_order_eager_options()).filter(
        Order.customer_id == customer_id,
        Order.status != 'cancelled'
    ).order_by(Order.delivery_date.desc(), Order.id.desc()).all()

    results = []
    for o in dos:
        portions = 0
        amt = 0.0
        if o.details:
            for d in o.details:
                try:
                    unit_price = calc_detail_price(d)
                    qty = d.quantity or 0
                    portions += qty
                    amt += qty * unit_price
                except Exception:
                    continue

        delivery_date_str = o.delivery_date.strftime("%Y-%m-%d") if o.delivery_date else today.strftime("%Y-%m-%d")
        do_num_str = f"DO-{o.delivery_date.strftime('%Y%m%d')}-{o.id:04d}" if o.delivery_date else f"DO-00000000-{o.id:04d}"

        days_old = (today - o.delivery_date).days if o.delivery_date else 0
        due_date = (o.delivery_date + timedelta(days=billing_cycle_days)) if o.delivery_date else today
        overdue_days = days_old - billing_cycle_days

        if overdue_days > 0:
            due_status_text = f"已到期 {overdue_days} 天"
            due_status_type = "overdue"
        elif overdue_days == 0:
            due_status_text = "今天到期"
            due_status_type = "due_today"
        else:
            due_status_text = f"还有 {abs(overdue_days)} 天到期"
            due_status_type = "within_terms"

        results.append({
            "order_id": o.id,
            "do_number": do_num_str,
            "delivery_date": delivery_date_str,
            "due_date": due_date.strftime("%Y-%m-%d"),
            "days_old": days_old,
            "overdue_days": overdue_days,
            "due_status_text": due_status_text,
            "due_status_type": due_status_type,
            "total_portions": portions,
            "amount": round(amt, 2),
            "is_billed": bool(o.invoice_id)
        })
    return results

@router.api_route("/payments", methods=["GET", "OPTIONS"])
def list_payments(
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PaymentRecord)
    if customer_id:
        query = query.filter(PaymentRecord.customer_id == customer_id)
    if start_date:
        query = query.filter(PaymentRecord.payment_date >= start_date)
    if end_date:
        query = query.filter(PaymentRecord.payment_date <= end_date)
    
    payments = query.order_by(PaymentRecord.payment_date.desc(), PaymentRecord.id.desc()).all()
    results = []
    for p in payments:
        cust = db.query(Customer).filter(Customer.id == p.customer_id).first()
        results.append({
            "id": p.id,
            "customer_id": p.customer_id,
            "company_name": cust.company_name if cust else "未知客户",
            "payment_date": p.payment_date.strftime("%Y-%m-%d"),
            "amount": round(p.amount, 2),
            "payment_method": p.payment_method,
            "reference_no": p.reference_no or "",
            "allocated_dos_text": p.allocated_dos_text or "",
            "remark": p.remark or "",
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else ""
        })
    return results

@router.post("/payments")
def create_payment(
    req: PaymentCreateRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="客户不存在")
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="还款金额必须大于 0")

    allocated_dos_str = req.allocated_dos_text or ""
    if req.do_ids and not allocated_dos_str:
        orders = db.query(Order).filter(Order.id.in_(req.do_ids)).all()
        do_nums = [f"DO-{o.delivery_date.strftime('%Y%m%d')}-{o.id:04d}" for o in orders]
        allocated_dos_str = ", ".join(do_nums)
        
    payment = PaymentRecord(
        customer_id=req.customer_id,
        payment_date=req.payment_date,
        amount=req.amount,
        payment_method=req.payment_method or "Bank Transfer",
        reference_no=req.reference_no or "",
        allocated_dos_text=allocated_dos_str,
        remark=req.remark or ""
    )
    db.add(payment)
    db.flush()
    access = sync_customer_access(db, cust)
    operator_name, operator_role = _operator(auth)
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_PAYMENT_CREATE,
        description=f"登记客户 {cust.company_name} 还款 RM {payment.amount:.2f}",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=cust.id,
        target_label=cust.company_name,
        extra_data={
            "payment_id": payment.id,
            "amount": payment.amount,
            "payment_date": payment.payment_date.isoformat(),
            "reference_no": payment.reference_no,
            "allocated_dos_text": payment.allocated_dos_text,
            "reason": payment.remark or "登记客户还款",
            "access_after": {
                "overdue_amount": access["overdue_amount"],
                "effective_is_blocked": access["effective_is_blocked"],
            },
        },
    )
    db.commit()
    db.refresh(payment)
    return {
        "detail": "还款记录添加成功",
        "id": payment.id,
        "amount": payment.amount,
        "allocated_dos_text": payment.allocated_dos_text,
        "payment_date": payment.payment_date.strftime("%Y-%m-%d")
    }

@router.delete("/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    reason: str = "后台删除还款记录",
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    payment = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="还款记录不存在")
    if len(reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="删除还款记录必须填写原因")
    customer = db.query(Customer).filter(Customer.id == payment.customer_id).first()
    snapshot = {
        "payment_id": payment.id,
        "amount": payment.amount,
        "payment_date": payment.payment_date.isoformat(),
        "reference_no": payment.reference_no,
        "allocated_dos_text": payment.allocated_dos_text,
        "remark": payment.remark,
    }
    db.delete(payment)
    db.flush()
    access = sync_customer_access(db, customer) if customer else None
    operator_name, operator_role = _operator(auth)
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_PAYMENT_DELETE,
        description=f"删除客户 {customer.company_name if customer else payment.customer_id} 的还款记录 #{payment_id}",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=payment.customer_id,
        target_label=customer.company_name if customer else str(payment.customer_id),
        extra_data={
            "reason": reason.strip(),
            "deleted_payment": snapshot,
            "access_after": {
                "overdue_amount": access["overdue_amount"],
                "effective_is_blocked": access["effective_is_blocked"],
            } if access else None,
        },
    )
    db.commit()
    return {"detail": "还款记录已删除"}


class InvoiceCreateRequest(BaseModel):
    customer_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_ids: Optional[List[int]] = None

class InvoiceStatusUpdate(BaseModel):
    status: str

@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
    if not invoices:
        return []

    cust_map = {c.id: c for c in db.query(Customer).all()}
    invoice_ids = [inv.id for inv in invoices]
    orders = db.query(Order).options(*get_order_eager_options()).filter(Order.invoice_id.in_(invoice_ids)).all()

    orders_by_invoice = {}
    for o in orders:
        orders_by_invoice.setdefault(o.invoice_id, []).append(o)

    results = []
    for inv in invoices:
        cust = cust_map.get(inv.customer_id)
        if not cust:
            continue
        
        inv_orders = orders_by_invoice.get(inv.id, [])
        orders_detail = []
        for o in inv_orders:
            meal_details = []
            total_portions = 0
            for d in o.details:
                pkg_name = d.customer_package.template.name if (d.customer_package and d.customer_package.template) else (
                    d.customer_addon.template.name if (d.customer_addon and d.customer_addon.template) else "未知"
                )
                subtotal = d.quantity * d.final_unit_price
                total_portions += d.quantity
                meal_details.append({
                    "meal_section": d.meal_section.name if d.meal_section else "普通餐项",
                    "package_name": pkg_name,
                    "quantity": d.quantity,
                    "unit_price": d.final_unit_price,
                    "subtotal": subtotal,
                    "remark": d.remark or ""
                })
            
            orders_detail.append({
                "order_id": o.id,
                "do_number": f"DO-{o.delivery_date.strftime('%Y%m%d')}-{o.id:04d}",
                "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
                "total_portions": total_portions,
                "meal_details": meal_details
            })
            
        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_id": inv.customer_id,
            "company_name": cust.company_name,
            "company_reg_no": cust.company_reg_no,
            "tax_number": cust.tax_number,
            "bank_name": cust.bank_name,
            "bank_account_no": cust.bank_account_no,
            "billing_cycle": f"{cust.billing_cycle} 天一结",
            "start_date": inv.start_date.strftime("%Y-%m-%d"),
            "end_date": inv.end_date.strftime("%Y-%m-%d"),
            "total_orders": len(inv_orders),
            "total_amount": inv.total_amount,
            "status": inv.payment_status.upper(),
            "orders_detail": orders_detail
        })
    return results

@router.get("/invoices/unbilled-orders")
def get_unbilled_orders(customer_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db)):
    query = db.query(Order).filter(
        Order.customer_id == customer_id,
        Order.invoice_id == None,
        Order.status != "cancelled"
    )
    if start_date:
        query = query.filter(Order.delivery_date >= start_date)
    if end_date:
        query = query.filter(Order.delivery_date <= end_date)
    orders = query.all()
    
    total_amount = 0.0
    order_list = []
    for o in orders:
        portions = 0
        amt = 0.0
        for d in o.details:
            portions += d.quantity
            amt += d.quantity * calc_detail_price(d)
        total_amount += amt
        order_list.append({
            "id": o.id,
            "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
            "portions": portions,
            "amount": round(amt, 2)
        })
    return {
        "orders": order_list,
        "total_amount": round(total_amount, 2)
    }

@router.post("/invoices")
def create_invoice(req: InvoiceCreateRequest, db: Session = Depends(get_db)):
    if req.order_ids:
        orders = db.query(Order).filter(
            Order.id.in_(req.order_ids),
            Order.customer_id == req.customer_id,
            Order.invoice_id == None,
            Order.status != "cancelled"
        ).all()
        if not orders:
            raise HTTPException(status_code=400, detail="所选订单已结算或不存在")
        
        req.start_date = min(o.delivery_date for o in orders)
        req.end_date = max(o.delivery_date for o in orders)
    else:
        if not req.start_date or not req.end_date:
            raise HTTPException(status_code=400, detail="请指定日期范围或选择特定订单")
        orders = db.query(Order).filter(
            Order.customer_id == req.customer_id,
            Order.delivery_date >= req.start_date,
            Order.delivery_date <= req.end_date,
            Order.invoice_id == None,
            Order.status != "cancelled"
        ).all()
        
        if not orders:
            raise HTTPException(status_code=400, detail="所选日期范围内没有未对账的订单")
        
    total_amount = sum(sum(d.quantity * calc_detail_price(d) for d in o.details) for o in orders)
    
    # Generate unique consolidated DO number in TDO-YYYYMMDD-0001 format
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    today_start = datetime(now.year, now.month, now.day)
    count_today = db.query(Invoice).filter(Invoice.created_at >= today_start).count() + 1
    invoice_number = f"TDO-{date_str}-{count_today:04d}"
    
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=req.customer_id,
        start_date=req.start_date,
        end_date=req.end_date,
        total_amount=total_amount,
        payment_status="unpaid"
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    # Link orders to this consolidated DO
    for o in orders:
        o.invoice_id = invoice.id
        o.status = "billed"
    db.commit()
    
    return {
        "detail": "总 DO 合并生成成功",
        "id": invoice.id,
        "invoice_id": invoice.id,
        "invoice_number": invoice_number,
        "total_amount": total_amount,
        "payment_status": invoice.payment_status
    }

@router.put("/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: int, req: InvoiceStatusUpdate, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
    
    status_lower = req.status.lower().strip()
    if status_lower in ["cancelled", "void", "voided", "cancel"]:
        status_lower = "cancelled"
    elif status_lower not in ["paid", "unpaid"]:
        raise HTTPException(status_code=400, detail=f"发票状态'{req.status}'不合法")

    # 如果是从正常状态切换为已作废 (cancelled) 或已经在 cancelled 下操作解绑
    if status_lower == "cancelled":
        # 解绑所有关联合同/订单，释放 DO 回退为待对账
        orders = db.query(Order).filter(Order.invoice_id == invoice.id).all()
        for o in orders:
            o.invoice_id = None
            o.status = "delivered"
            
    invoice.payment_status = status_lower
    db.commit()
    return {"detail": "发票状态更新成功，关联合同/DO已顺利释放"}

@router.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
        
    # Unlink orders if not already unlinked
    orders = db.query(Order).filter(Order.invoice_id == invoice.id).all()
    for o in orders:
        o.invoice_id = None
        o.status = "delivered"
    
    db.delete(invoice)
    db.commit()
    return {"detail": "发票记录已成功彻底删除，相关 DO 已释放"}


def calc_detail_price(d) -> float:
    """自动追溯单价：优先 final_unit_price -> 客户协议价 -> 全局模板价"""
    if d.final_unit_price and d.final_unit_price > 0:
        return d.final_unit_price
    if d.customer_package:
        if d.customer_package.agreement_price and d.customer_package.agreement_price > 0:
            return d.customer_package.agreement_price
        if d.customer_package.template and d.customer_package.template.price:
            return d.customer_package.template.price
    if d.customer_addon:
        if d.customer_addon.agreement_price and d.customer_addon.agreement_price > 0:
            return d.customer_addon.agreement_price
        if d.customer_addon.template and d.customer_addon.template.price:
            return d.customer_addon.template.price
    return 0.0


@router.get("/invoices/daily-dos")
def get_daily_dos(
    customer_id: Optional[int] = None,
    status_filter: Optional[str] = None, # 'billed', 'unbilled', 'all'
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    按日整合客户 DO 列表 API
    支持查看每一天整合后的 DO 明细、开票状态、份数及总金额
    """
    query = db.query(Order).options(*get_order_eager_options()).filter(Order.status != "cancelled")
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)
    if start_date:
        query = query.filter(Order.delivery_date >= start_date)
    if end_date:
        query = query.filter(Order.delivery_date <= end_date)
    
    if status_filter == "unbilled":
        query = query.filter(Order.invoice_id == None)
    elif status_filter == "billed":
        query = query.filter(Order.invoice_id != None)

    orders = query.order_by(Order.delivery_date.desc(), Order.id.desc()).all()
    
    inv_map = {inv.id: inv.invoice_number for inv in db.query(Invoice).all()}

    results = []
    for o in orders:
        cust = o.customer
        cust_name = cust.company_name if cust else "未知客户"
        invoice_number = inv_map.get(o.invoice_id) if o.invoice_id else None

        meal_details = []
        total_portions = 0
        total_amount = 0.0
        for d in o.details:
            pkg_name = d.customer_package.template.name if (d.customer_package and d.customer_package.template) else (
                d.customer_addon.template.name if (d.customer_addon and d.customer_addon.template) else "自定义餐食"
            )
            unit_price = calc_detail_price(d)
            subtotal = d.quantity * unit_price
            total_portions += d.quantity
            total_amount += subtotal
            meal_details.append({
                "meal_section": d.meal_section.name if d.meal_section else "普通餐项",
                "package_name": pkg_name,
                "quantity": d.quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "remark": d.remark or ""
            })

        results.append({
            "order_id": o.id,
            "do_number": f"DO-{o.delivery_date.strftime('%Y%m%d')}-{o.id:04d}",
            "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
            "customer_id": o.customer_id,
            "company_name": cust_name,
            "company_reg_no": cust.company_reg_no if cust else "",
            "tax_number": cust.tax_number if cust else "",
            "status": "billed" if o.invoice_id else "unbilled",
            "invoice_id": o.invoice_id,
            "invoice_number": invoice_number,
            "total_portions": total_portions,
            "total_amount": round(total_amount, 2),
            "amount": round(total_amount, 2),
            "meal_details": meal_details
        })
    return results


@router.get("/invoices/statement")
def get_customer_statement(
    customer_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    客户 Statement DO 对账单与余额流水 API
    包含客户资料、区间 DO 送货汇总、还款/打款记录、未结清欠款余额及详细 DO 变动明细
    """
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="客户不存在")
        
    inv_query = db.query(Invoice).filter(Invoice.customer_id == customer_id)
    do_query = db.query(Order).options(*get_order_eager_options()).filter(Order.customer_id == customer_id, Order.status != "cancelled")
    payment_query = db.query(PaymentRecord).filter(PaymentRecord.customer_id == customer_id)

    if start_date:
        inv_query = inv_query.filter(Invoice.end_date >= start_date)
        do_query = do_query.filter(Order.delivery_date >= start_date)
        payment_query = payment_query.filter(PaymentRecord.payment_date >= start_date)
    if end_date:
        inv_query = inv_query.filter(Invoice.start_date <= end_date)
        do_query = do_query.filter(Order.delivery_date <= end_date)
        payment_query = payment_query.filter(PaymentRecord.payment_date <= end_date)

    invoices = inv_query.order_by(Invoice.id.desc()).all()
    dos = do_query.order_by(Order.delivery_date.desc()).all()
    payments = payment_query.order_by(PaymentRecord.payment_date.desc(), PaymentRecord.id.desc()).all()

    # 计算历史总 DO 金额与总还款额，得出当前真实尚欠余额 (Outstanding Balance)
    all_dos = db.query(Order).options(*get_order_eager_options()).filter(Order.customer_id == customer_id, Order.status != "cancelled").all()
    total_all_dos_amount = sum(sum(d.quantity * calc_detail_price(d) for d in o.details) for o in all_dos)
    
    all_payments = db.query(PaymentRecord).filter(PaymentRecord.customer_id == customer_id).all()
    total_all_paid_amount = sum(p.amount for p in all_payments)
    
    current_outstanding_balance = total_all_dos_amount - total_all_paid_amount

    # 计算本期送货总额与本期还款总额
    period_invoiced = sum(sum(d.quantity * calc_detail_price(d) for d in o.details) for o in dos)
    period_paid = sum(p.amount for p in payments)

    # 计算期初余额与余额流水
    balance_bf = 0.0
    if start_date:
        bf_dos = db.query(Order).options(*get_order_eager_options()).filter(
            Order.customer_id == customer_id,
            Order.status != "cancelled",
            Order.delivery_date < start_date
        ).all()
        bf_dos_amount = sum(sum(d.quantity * calc_detail_price(d) for d in o.details) for o in bf_dos)
        
        bf_payments = db.query(PaymentRecord).filter(
            PaymentRecord.customer_id == customer_id,
            PaymentRecord.payment_date < start_date
        ).all()
        bf_paid_amount = sum(p.amount for p in bf_payments)
        balance_bf = bf_dos_amount - bf_paid_amount

    balance_cf = balance_bf + period_invoiced - period_paid
    balance_flow = {
        "balance_bf": round(balance_bf, 2),
        "period_invoiced": round(period_invoiced, 2),
        "period_paid": round(period_paid, 2),
        "balance_cf": round(balance_cf, 2)
    }

    # Build DO details summary for statement (包含单价 Unit Price 和 Subtotal 小计)
    today = date.today()
    try:
        billing_cycle_days = int(str(cust.billing_cycle).replace('天', '').strip()) if cust and cust.billing_cycle else 14
    except Exception:
        billing_cycle_days = 14

    do_list = []
    total_portions = 0
    total_dos_amount = 0.0
    unbilled_dos_amount = 0.0

    within_terms_amount = 0.0
    within_terms_count = 0
    total_overdue_amount = 0.0

    overdue_1_7 = {"amount": 0.0, "count": 0}
    overdue_8_14 = {"amount": 0.0, "count": 0}
    overdue_15_30 = {"amount": 0.0, "count": 0}
    overdue_over_30 = {"amount": 0.0, "count": 0}

    aging = {
        "current": {"amount": 0.0, "count": 0},
        "days_31_60": {"amount": 0.0, "count": 0},
        "days_61_90": {"amount": 0.0, "count": 0},
        "days_over_90": {"amount": 0.0, "count": 0}
    }

    for o in dos:
        portions = 0
        amt = 0.0
        meal_details = []
        for d in o.details:
            pkg_name = d.customer_package.template.name if d.customer_package else (
                d.customer_addon.template.name if d.customer_addon else "自定义餐项"
            )
            unit_price = calc_detail_price(d)
            subtotal = d.quantity * unit_price
            portions += d.quantity
            amt += subtotal
            meal_details.append({
                "meal_section": d.meal_section.name if d.meal_section else "普通餐项",
                "package_name": pkg_name,
                "quantity": d.quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "remark": d.remark or ""
            })

        total_portions += portions
        total_dos_amount += amt
        if not o.invoice_id:
            unbilled_dos_amount += amt

        inv_no = None
        if o.invoice_id:
            inv = db.query(Invoice).filter(Invoice.id == o.invoice_id).first()
            if inv:
                inv_no = inv.invoice_number

        days_old = (today - o.delivery_date).days if o.delivery_date else 0
        due_date = (o.delivery_date + timedelta(days=billing_cycle_days)) if o.delivery_date else today
        overdue_days = days_old - billing_cycle_days

        if overdue_days > 0:
            due_status_text = f"已到期 {overdue_days} 天"
            due_status_type = "overdue"
        elif overdue_days == 0:
            due_status_text = "今天到期"
            due_status_type = "due_today"
        else:
            due_status_text = f"还有 {abs(overdue_days)} 天到期"
            due_status_type = "within_terms"

        # 1. 通用自然日历账龄
        if days_old <= 30:
            aging["current"]["amount"] += amt
            aging["current"]["count"] += 1
        elif days_old <= 60:
            aging["days_31_60"]["amount"] += amt
            aging["days_31_60"]["count"] += 1
        elif days_old <= 90:
            aging["days_61_90"]["amount"] += amt
            aging["days_61_90"]["count"] += 1
        else:
            aging["days_over_90"]["amount"] += amt
            aging["days_over_90"]["count"] += 1

        # 2. 结合客户账期 (3/7/14/30天) 的精准逾期天数计算
        if overdue_days <= 0:
            within_terms_amount += amt
            within_terms_count += 1
        else:
            total_overdue_amount += amt
            if overdue_days <= 7:
                overdue_1_7["amount"] += amt
                overdue_1_7["count"] += 1
            elif overdue_days <= 14:
                overdue_8_14["amount"] += amt
                overdue_8_14["count"] += 1
            elif overdue_days <= 30:
                overdue_15_30["amount"] += amt
                overdue_15_30["count"] += 1
            else:
                overdue_over_30["amount"] += amt
                overdue_over_30["count"] += 1
                
        do_list.append({
            "order_id": o.id,
            "do_number": f"DO-{o.delivery_date.strftime('%Y%m%d')}-{o.id:04d}",
            "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
            "due_date": due_date.strftime("%Y-%m-%d"),
            "days_old": days_old,
            "overdue_days": overdue_days,
            "due_status_text": due_status_text,
            "due_status_type": due_status_type,
            "total_portions": portions,
            "amount": round(amt, 2),
            "is_billed": bool(o.invoice_id),
            "invoice_number": inv_no,
            "meal_details": meal_details
        })

    # 还款明细列表
    payment_list = []
    for p in payments:
        payment_list.append({
            "id": p.id,
            "payment_date": p.payment_date.strftime("%Y-%m-%d"),
            "amount": round(p.amount, 2),
            "payment_method": p.payment_method,
            "reference_no": p.reference_no or "",
            "allocated_dos_text": p.allocated_dos_text or "",
            "remark": p.remark or ""
        })

    terms_aging = {
        "cycle_days": billing_cycle_days,
        "within_terms": {
            "amount": round(within_terms_amount, 2),
            "count": within_terms_count
        },
        "overdue_1_7": {
            "amount": round(overdue_1_7["amount"], 2),
            "count": overdue_1_7["count"]
        },
        "overdue_8_14": {
            "amount": round(overdue_8_14["amount"], 2),
            "count": overdue_8_14["count"]
        },
        "overdue_15_30": {
            "amount": round(overdue_15_30["amount"], 2),
            "count": overdue_15_30["count"]
        },
        "overdue_over_30": {
            "amount": round(overdue_over_30["amount"], 2),
            "count": overdue_over_30["count"]
        },
        "total_overdue": {
            "amount": round(total_overdue_amount, 2),
            "count": len(dos) - within_terms_count
        }
    }

    inv_list = []
    for inv in invoices:
        inv_list.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "start_date": inv.start_date.strftime("%Y-%m-%d"),
            "end_date": inv.end_date.strftime("%Y-%m-%d"),
            "total_amount": round(inv.total_amount, 2),
            "status": inv.payment_status.upper(),
            "do_count": db.query(Order).filter(Order.invoice_id == inv.id).count(),
            "created_date": inv.created_at.strftime("%Y-%m-%d") if inv.created_at else None
        })

    return {
        "customer": {
            "id": cust.id,
            "company_name": cust.company_name,
            "company_reg_no": cust.company_reg_no,
            "tax_number": cust.tax_number,
            "billing_cycle": cust.billing_cycle,
            "bank_name": cust.bank_name,
            "bank_account_no": cust.bank_account_no,
            "company_address": cust.company_address,
            "contact_name": cust.contact_name,
            "phone": cust.phone,
            "email": cust.email,
        },
        "summary": {
            "total_invoiced": round(period_invoiced, 2),
            "paid_amount": round(period_paid, 2),
            "outstanding_balance": round(current_outstanding_balance, 2),
            "total_all_dos_amount": round(total_all_dos_amount, 2),
            "total_all_paid_amount": round(total_all_paid_amount, 2),
            "total_dos": len(dos),
            "total_portions": total_portions,
            "total_dos_amount": round(total_dos_amount, 2),
            "unbilled_dos_amount": round(unbilled_dos_amount, 2),
            "period_start": start_date.strftime("%Y-%m-%d") if start_date else None,
            "period_end": end_date.strftime("%Y-%m-%d") if end_date else None
        },
        "aging": aging,
        "terms_aging": terms_aging,
        "balance_flow": balance_flow,
        "invoices": inv_list,
        "payments": payment_list,
        "dos": do_list
    }


@router.get("/invoices/meal-volume")
def get_meal_volume_records(
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    客户订餐数量统计与记录 API
    按日期、餐次、套餐分类汇总订餐份数
    """
    query = db.query(Order).options(*get_order_eager_options()).filter(Order.status != "cancelled")
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)
    if start_date:
        query = query.filter(Order.delivery_date >= start_date)
    if end_date:
        query = query.filter(Order.delivery_date <= end_date)

    orders = query.order_by(Order.delivery_date.desc()).all()
    
    daily_records = []
    total_overall_portions = 0
    total_overall_amount = 0.0
    global_section_stats = {}
    site_stats = {}
    weekday_stats = {i: {"total_portions": 0, "orders_count": 0} for i in range(7)}
    item_stats = {}

    for o in orders:
        cust = o.customer
        cust_name = cust.company_name if cust else "未知客户"
        
        site_name = o.site.site_name if getattr(o, "site", None) else "默认分点"
        if site_name not in site_stats:
            site_stats[site_name] = {"total_portions": 0, "total_amount": 0.0}
            
        weekday = o.delivery_date.weekday()
        weekday_stats[weekday]["orders_count"] += 1
        
        section_breakdown = {}
        order_portions = 0
        order_amount = 0.0
        
        for d in o.details:
            sec_name = d.meal_section.name if d.meal_section else "其他餐次"
            pkg_name = d.customer_package.template.name if d.customer_package else (
                d.customer_addon.template.name if d.customer_addon else "自定义餐项"
            )
            
            subtotal = d.quantity * d.final_unit_price
            order_portions += d.quantity
            order_amount += subtotal

            if sec_name not in global_section_stats:
                global_section_stats[sec_name] = {"total_portions": 0, "total_amount": 0.0}
            global_section_stats[sec_name]["total_portions"] += d.quantity
            global_section_stats[sec_name]["total_amount"] += subtotal

            if pkg_name not in item_stats:
                item_stats[pkg_name] = {"total_quantity": 0, "total_amount": 0.0}
            item_stats[pkg_name]["total_quantity"] += d.quantity
            item_stats[pkg_name]["total_amount"] += subtotal

            if sec_name not in section_breakdown:
                section_breakdown[sec_name] = []
            
            section_breakdown[sec_name].append({
                "package_name": pkg_name,
                "quantity": d.quantity,
                "unit_price": d.final_unit_price,
                "subtotal": subtotal,
                "remark": d.remark or ""
            })

        total_overall_portions += order_portions
        total_overall_amount += order_amount
        
        site_stats[site_name]["total_portions"] += order_portions
        site_stats[site_name]["total_amount"] += order_amount
        weekday_stats[weekday]["total_portions"] += order_portions

        daily_records.append({
            "order_id": o.id,
            "do_number": f"DO-{o.delivery_date.strftime('%Y%m%d')}-{o.id:04d}",
            "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
            "customer_id": o.customer_id,
            "company_name": cust_name,
            "total_portions": order_portions,
            "total_amount": order_amount,
            "section_breakdown": [
                {
                    "section_name": sec_name,
                    "items": items
                }
                for sec_name, items in section_breakdown.items()
            ]
        })

    max_portions = 0
    max_date = None
    for r in daily_records:
        if r["total_portions"] > max_portions:
            max_portions = r["total_portions"]
            max_date = r["delivery_date"]

    section_summary = []
    for sec_name, stats in sorted(global_section_stats.items(), key=lambda x: x[1]["total_portions"], reverse=True):
        pct = (stats["total_portions"] / total_overall_portions * 100) if total_overall_portions > 0 else 0
        section_summary.append({
            "section_name": sec_name,
            "total_portions": stats["total_portions"],
            "total_amount": stats["total_amount"],
            "percentage": round(pct, 1)
        })

    # 计算厂区分点、星期、餐项的 Summary
    site_summary = []
    for site_name, stats in sorted(site_stats.items(), key=lambda x: x[1]["total_portions"], reverse=True):
        pct = (stats["total_portions"] / total_overall_portions * 100) if total_overall_portions > 0 else 0
        site_summary.append({
            "site_name": site_name,
            "total_portions": stats["total_portions"],
            "total_amount": stats["total_amount"],
            "percentage": round(pct, 1)
        })

    weekday_names = ["周一/Mon", "周二/Tue", "周三/Wed", "周四/Thu", "周五/Fri", "周六/Sat", "周日/Sun"]
    weekday_summary = []
    for i in range(7):
        stats = weekday_stats[i]
        pct = (stats["total_portions"] / total_overall_portions * 100) if total_overall_portions > 0 else 0
        weekday_summary.append({
            "weekday": weekday_names[i],
            "total_portions": stats["total_portions"],
            "orders_count": stats["orders_count"],
            "percentage": round(pct, 1)
        })

    item_summary = []
    for item_name, stats in sorted(item_stats.items(), key=lambda x: x[1]["total_quantity"], reverse=True):
        pct = (stats["total_quantity"] / total_overall_portions * 100) if total_overall_portions > 0 else 0
        item_summary.append({
            "item_name": item_name,
            "total_quantity": stats["total_quantity"],
            "total_amount": stats["total_amount"],
            "percentage": round(pct, 1)
        })

    # 计算 7日移动平均波动预警
    cust_records = {}
    for r in daily_records:
        cust_records.setdefault(r["customer_id"], []).append(r)
        
    for cid, recs in cust_records.items():
        recs.sort(key=lambda x: x["delivery_date"])
        for i, r in enumerate(recs):
            window = recs[max(0, i-3):i+4]
            window_avg = sum(w["total_portions"] for w in window) / len(window)
            diff = r["total_portions"] - window_avg
            pct = (diff / window_avg * 100) if window_avg > 0 else 0.0
            
            if pct > 30 and diff >= 15:
                r["variance_status"] = "high"
            elif pct < -30 and diff <= -15:
                r["variance_status"] = "low"
            else:
                r["variance_status"] = "normal"
            r["variance_pct"] = f"{pct:+.1f}%"
            
    # 将所有记录恢复为按日期降序
    daily_records.sort(key=lambda x: x["delivery_date"], reverse=True)

    return {
        "summary": {
            "total_orders": len(orders),
            "total_portions": total_overall_portions,
            "total_amount": total_overall_amount,
            "avg_daily_portions": round(total_overall_portions / len(orders), 1) if orders else 0,
            "max_daily_portions": max_portions,
            "max_daily_date": max_date,
            "section_count": len(global_section_stats)
        },
        "site_summary": site_summary,
        "weekday_summary": weekday_summary,
        "item_summary": item_summary,
        "section_summary": section_summary,
        "records": daily_records
    }


# ============================================================
# 8. Add-on 单点池 — 全局主档 CRUD
# ============================================================

@router.get("/addons", response_model=List[AddonTemplateResponse])
def list_addon_templates(db: Session = Depends(get_db)):
    """获取全部 Add-on 模板（鸡蛋、白饭、水果等）"""
    return db.query(AddonTemplate).order_by(AddonTemplate.id).all()


@router.post("/addons", response_model=AddonTemplateResponse)
def create_addon_template(req: AddonTemplateCreate, db: Session = Depends(get_db)):
    """在全局 Add-on 池中创建新单点项"""
    addon = AddonTemplate(**req.dict())
    db.add(addon)
    db.commit()
    db.refresh(addon)
    return addon


@router.put("/addons/{addon_id}", response_model=AddonTemplateResponse)
def update_addon_template(addon_id: int, req: AddonTemplateCreate, db: Session = Depends(get_db)):
    """修改指定 Add-on 模板的名称、单价或描述"""
    addon = db.query(AddonTemplate).filter(AddonTemplate.id == addon_id).first()
    if not addon:
        raise HTTPException(status_code=404, detail="Add-on 模板不存在")
    for key, value in req.dict().items():
        setattr(addon, key, value)
    db.commit()
    db.refresh(addon)
    return addon


@router.delete("/addons/{addon_id}")
def delete_addon_template(addon_id: int, db: Session = Depends(get_db)):
    """
    删除 Add-on 模板。
    若已被分配给任何客户，则拒绝删除（需先在客户菜单库中移除）。
    """
    addon = db.query(AddonTemplate).filter(AddonTemplate.id == addon_id).first()
    if not addon:
        raise HTTPException(status_code=404, detail="Add-on 模板不存在")

    in_use = db.query(CustomerAddon).filter(
        CustomerAddon.addon_template_id == addon_id
    ).first()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail="该 Add-on 已被分配给客户，请先在顾客专属菜单库中将其删除。"
        )

    try:
        db.delete(addon)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="该 Add-on 存在关联订单历史，无法删除。")

    return {"detail": "删除成功"}


# ============================================================
# 9. 客户专属 Add-on 指派管理
# ============================================================

class CustomerAddonAssignRequest(BaseModel):
    addon_template_id: int
    agreement_price: float


class CustomerAddonUpdateRequest(BaseModel):
    agreement_price: float


@router.get("/customers/{customer_id}/addons")
def get_customer_addons(customer_id: int, db: Session = Depends(get_db)):
    """查询指定客户已分配的全部 Add-on 及协议价"""
    cas = db.query(CustomerAddon).filter(
        CustomerAddon.customer_id == customer_id
    ).all()
    result = []
    for ca in cas:
        result.append({
            "id": ca.id,
            "customer_id": ca.customer_id,
            "addon_template_id": ca.addon_template_id,
            "addon_name": ca.template.name,
            "description": ca.template.description,
            "default_price": ca.template.default_price,
            "agreement_price": ca.agreement_price,
        })
    return result


@router.post("/customers/{customer_id}/addons")
def assign_addon_to_customer(
    customer_id: int,
    req: CustomerAddonAssignRequest,
    db: Session = Depends(get_db)
):
    """
    将 Add-on 模板指派给指定客户并设定协议价。
    若该客户已存在相同 Add-on，则更新协议价（幂等设计）。
    """
    template = db.query(AddonTemplate).filter(
        AddonTemplate.id == req.addon_template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Add-on 模板不存在")

    # NOTE: 幂等处理——同一客户相同 Add-on 不重复创建，改为更新价格
    existing = db.query(CustomerAddon).filter(
        CustomerAddon.customer_id == customer_id,
        CustomerAddon.addon_template_id == req.addon_template_id
    ).first()

    if existing:
        existing.agreement_price = req.agreement_price
        db.commit()
        db.refresh(existing)
        ca = existing
    else:
        ca = CustomerAddon(
            customer_id=customer_id,
            addon_template_id=req.addon_template_id,
            agreement_price=req.agreement_price
        )
        db.add(ca)
        db.commit()
        db.refresh(ca)

    return {
        "id": ca.id,
        "customer_id": ca.customer_id,
        "addon_template_id": ca.addon_template_id,
        "addon_name": template.name,
        "agreement_price": ca.agreement_price,
    }


@router.put("/customers/{customer_id}/addons/{ca_id}")
def update_customer_addon_price(
    customer_id: int,
    ca_id: int,
    req: CustomerAddonUpdateRequest,
    db: Session = Depends(get_db)
):
    """修改客户专属 Add-on 协议价"""
    ca = db.query(CustomerAddon).filter(
        CustomerAddon.id == ca_id,
        CustomerAddon.customer_id == customer_id
    ).first()
    if not ca:
        raise HTTPException(status_code=404, detail="该专属 Add-on 不存在")

    ca.agreement_price = req.agreement_price
    db.commit()
    db.refresh(ca)
    return {
        "id": ca.id,
        "customer_id": ca.customer_id,
        "addon_template_id": ca.addon_template_id,
        "addon_name": ca.template.name,
        "agreement_price": ca.agreement_price,
    }


@router.delete("/customers/{customer_id}/addons/{ca_id}")
def delete_customer_addon(customer_id: int, ca_id: int, db: Session = Depends(get_db)):
    """从客户菜单库中移除指定 Add-on（保留订单历史，硬删除 CustomerAddon 行）"""
    ca = db.query(CustomerAddon).filter(
        CustomerAddon.id == ca_id,
        CustomerAddon.customer_id == customer_id
    ).first()
    if not ca:
        raise HTTPException(status_code=404, detail="该专属 Add-on 不存在")

    try:
        db.delete(ca)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="该 Add-on 存在关联的订单历史记录，无法直接删除。"
        )

    return {"detail": "已成功从该客户菜单库中移除"}


# ============================================================
# 10. 餐次排班管理 (Meal Sections Management)
# ============================================================

@router.get("/meal-sections", response_model=List[MealSectionResponse])
def list_meal_sections(db: Session = Depends(get_db)):
    """获取所有餐次定义，按 sort_order 升序"""
    return db.query(MealSection).order_by(MealSection.sort_order.asc(), MealSection.id.asc()).all()


@router.post("/meal-sections", response_model=MealSectionResponse)
def create_meal_section(req: MealSectionCreate, db: Session = Depends(get_db)):
    """创建新餐次"""
    existing = db.query(MealSection).filter(MealSection.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="餐次名称已存在")
    
    sec = MealSection(
        name=req.name,
        sort_order=req.sort_order,
        allowed_categories=req.allowed_categories
    )
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return sec


@router.put("/meal-sections/{sec_id}", response_model=MealSectionResponse)
def update_meal_section(sec_id: int, req: MealSectionCreate, db: Session = Depends(get_db)):
    """更新餐次信息（名称、排序、可用分类）"""
    sec = db.query(MealSection).filter(MealSection.id == sec_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="餐次不存在")
    
    # 重名检测
    existing = db.query(MealSection).filter(MealSection.name == req.name, MealSection.id != sec_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="餐次名称已存在")

    sec.name = req.name
    sec.sort_order = req.sort_order
    sec.allowed_categories = req.allowed_categories
    
    db.commit()
    db.refresh(sec)
    return sec


@router.delete("/meal-sections/{sec_id}")
def delete_meal_section(sec_id: int, db: Session = Depends(get_db)):
    """删除餐次（若已有订单引用则限制删除）"""
    sec = db.query(MealSection).filter(MealSection.id == sec_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="餐次不存在")
    
    # 检查是否有订单明细使用了该餐次
    in_use = db.query(OrderDetail).filter(OrderDetail.meal_section_id == sec_id).first()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail="该餐次下已有订单历史记录，为了数据对账完整性，系统限制直接删除。请通过将该餐次的分类配置清空来对客户端隐藏该餐次。"
        )

    db.delete(sec)
    db.commit()
    return {"detail": "已成功删除该餐次定义"}


# ============================================================
# 11. 顾客下单餐次开通管理 (Customer Meal Sections Assign)
# ============================================================

@router.get("/customers/{customer_id}/meal-sections", response_model=List[int])
def get_customer_assigned_meal_sections(customer_id: int, db: Session = Depends(get_db)):
    """获取指定顾客当前开通的餐次 ID 列表"""
    assigned = db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == customer_id).all()
    return [item.meal_section_id for item in assigned]


@router.post("/customers/{customer_id}/meal-sections")
def save_customer_meal_sections(customer_id: int, req: CustomerMealSectionsUpdate, db: Session = Depends(get_db)):
    """保存并更新指定顾客已开通的下单餐次"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    # 1. 删除现有的开通记录
    db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == customer_id).delete()

    # 2. 批量写入新的开通记录
    for sid in req.meal_section_ids:
        # 确保餐次存在
        exists = db.query(MealSection).filter(MealSection.id == sid).first()
        if exists:
            db.add(CustomerMealSection(customer_id=customer_id, meal_section_id=sid))
            
    db.commit()
    return {"detail": "餐次开通权限已更新！"}


