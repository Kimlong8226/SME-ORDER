from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

from database import get_db
from model.models import (
    Customer, CustomerUser, DeliverySite, PackageTemplate, AddonTemplate,
    CustomerPackage, CustomerAddon, StaffUser, Order, OrderDetail, MealSection, Invoice
)
from schema.schemas import (
    CustomerCreate, CustomerResponse, CustomerBase, DeliverySiteCreate, DeliverySiteResponse,
    StaffUserCreate, StaffUserResponse, PackageTemplateCreate, PackageTemplateResponse,
    CustomerPackageAssign, CustomerPackageResponse,
    AddonTemplateCreate, AddonTemplateResponse, CustomerAddonAssign, CustomerAddonResponse
)
from api.auth import get_password_hash

router = APIRouter(prefix="/admin", tags=["Admin Management"])

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

# --- 1. 客户档案管理 ---
@router.post("/customers", response_model=CustomerResponse)
def create_customer(req: CustomerCreate, db: Session = Depends(get_db)):
    existing_user = db.query(CustomerUser).filter(CustomerUser.username == req.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="订餐员用户名已存在")

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
        is_blocked=req.is_blocked
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
    return db.query(Customer).order_by(Customer.id.desc()).all()

@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, req: CustomerBase, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    for key, value in req.dict().items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return customer

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

# --- 2. 内部员工账号管理 ---
@router.post("/staff", response_model=StaffUserResponse)
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

@router.get("/staff", response_model=List[StaffUserResponse])
def list_staff(db: Session = Depends(get_db)):
    return db.query(StaffUser).all()

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
@router.get("/all-orders")
def get_all_orders(
    target_date: Optional[date] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if target_date:
        query = query.filter(Order.delivery_date == target_date)
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
            "total_portions": total_portions,
            "total_price": total_price,
            "details": details_list,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return results

@router.put("/orders/{order_id}")
def edit_order_by_admin(order_id: int, req: OrderEditRequest, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    order.delivery_site_id = req.site_id
    order.delivery_date = req.delivery_date

    db.query(OrderDetail).filter(OrderDetail.order_id == order_id).delete()

    for item in req.items:
        if item.quantity > 0:
            cp = db.query(CustomerPackage).filter(CustomerPackage.id == item.customer_package_id).first()
            unit_price = cp.agreement_price if cp else 15.0

            db.add(OrderDetail(
                order_id=order_id,
                meal_section_id=item.meal_section_id,
                customer_package_id=item.customer_package_id,
                quantity=item.quantity,
                final_unit_price=unit_price,
                remark=item.remark or ""
            ))

    db.commit()
    return {"message": "订单数据更新成功！", "order_id": order_id}

@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    order.status = status
    db.commit()
    return {"message": "状态修改成功", "order_id": order_id, "new_status": status}

@router.delete("/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    db.query(OrderDetail).filter(OrderDetail.order_id == order_id).delete()
    db.delete(order)
    db.commit()
    return {"message": "订单已成功删除", "order_id": order_id}

# --- 5. 订单日历与配餐/送货单打印 API ---
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
    today = date.today()
    today_orders = db.query(Order).filter(Order.delivery_date == today).all()
    today_portions = sum(sum(d.quantity for d in o.details) for o in today_orders)

    total_customers = db.query(Customer).count()
    blocked_customers = db.query(Customer).filter(Customer.is_blocked == True).count()

    all_orders = db.query(Order).all()
    month_revenue = 0.0
    for o in all_orders:
        for d in o.details:
            month_revenue += (d.quantity * d.final_unit_price)

    return {
        "today_portions": today_portions,
        "today_orders_count": len(today_orders),
        "total_customers": total_customers,
            "blocked_customers": blocked_customers,
        "month_revenue": month_revenue,
        "today_date": today.strftime("%Y-%m-%d")
    }

# --- 7. 对账账单 Invoice API ---
class InvoiceCreateRequest(BaseModel):
    customer_id: int
    start_date: date
    end_date: date

class InvoiceStatusUpdate(BaseModel):
    status: str

@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
    results = []
    for inv in invoices:
        cust = db.query(Customer).filter(Customer.id == inv.customer_id).first()
        if not cust:
            continue
        
        orders = db.query(Order).filter(Order.invoice_id == inv.id).all()
        
        # Build orders_detail for preview
        orders_detail = []
        for o in orders:
            meal_details = []
            total_portions = 0
            for d in o.details:
                pkg_name = d.customer_package.template.name if d.customer_package else (
                    d.customer_addon.template.name if d.customer_addon else "未知"
                )
                subtotal = d.quantity * d.final_unit_price
                total_portions += d.quantity
                meal_details.append({
                    "meal_section": d.meal_section.name,
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
            "total_orders": len(orders),
            "total_amount": inv.total_amount,
            "status": inv.payment_status.upper(),
            "orders_detail": orders_detail
        })
    return results

@router.get("/invoices/unbilled-orders")
def get_unbilled_orders(customer_id: int, start_date: date, end_date: date, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(
        Order.customer_id == customer_id,
        Order.delivery_date >= start_date,
        Order.delivery_date <= end_date,
        Order.invoice_id == None,
        Order.status != "cancelled"
    ).all()
    
    total_amount = 0.0
    order_list = []
    for o in orders:
        portions = 0
        amt = 0.0
        for d in o.details:
            portions += d.quantity
            amt += d.quantity * d.final_unit_price
        total_amount += amt
        order_list.append({
            "id": o.id,
            "delivery_date": o.delivery_date.strftime("%Y-%m-%d"),
            "portions": portions,
            "amount": amt
        })
    return {
        "orders": order_list,
        "total_amount": total_amount
    }

@router.post("/invoices")
def create_invoice(req: InvoiceCreateRequest, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(
        Order.customer_id == req.customer_id,
        Order.delivery_date >= req.start_date,
        Order.delivery_date <= req.end_date,
        Order.invoice_id == None,
        Order.status != "cancelled"
    ).all()
    
    if not orders:
        raise HTTPException(status_code=400, detail="所选日期范围内没有未对账的订单")
        
    total_amount = sum(sum(d.quantity * d.final_unit_price for d in o.details) for o in orders)
    
    # Generate unique invoice number
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    invoice_number = f"INV-KL-{req.customer_id}-{timestamp}"
    
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
    
    # Link orders to this invoice
    for o in orders:
        o.invoice_id = invoice.id
        o.status = "billed"
    db.commit()
    
    return {"detail": "对账单生成成功", "invoice_number": invoice_number}

@router.put("/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: int, req: InvoiceStatusUpdate, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
    
    status_lower = req.status.lower()
    if status_lower not in ["paid", "unpaid"]:
        raise HTTPException(status_code=400, detail="状态不合法")
        
    invoice.payment_status = status_lower
    db.commit()
    return {"detail": "状态更新成功"}

@router.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
        
    # Unlink orders
    orders = db.query(Order).filter(Order.invoice_id == invoice.id).all()
    for o in orders:
        o.invoice_id = None
        o.status = "delivered"
    
    db.delete(invoice)
    db.commit()
    return {"detail": "对账单已成功撤销，相关订单已重新释放"}


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
