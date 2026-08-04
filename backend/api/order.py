from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timezone
from uuid import uuid4
import re

from pydantic import BaseModel

from database import get_db
from model.models import (
    Order, OrderDetail, Customer, CustomerUser, CustomerPackage, CustomerAddon, AddonTemplate,
    MealSection, DeliverySite, CustomerMealSection, OrderEditSession,
    AUDIT_ACTION_ORDER_CREATE, AUDIT_ACTION_ORDER_UPDATE, AUDIT_ACTION_ORDER_CANCEL
)
from schema.schemas import OrderCreateMatrix, OrderResponse, OrderDetailResponse
from api.audit_utils import write_audit_log
from api.auth import require_customer_access
from api.meal_section_rules import effective_meal_section_categories
from api.order_rules import (
    MALAYSIA_TZ,
    TEMP_ACCESS_DELIVERY_DAYS,
    malaysia_now,
    order_cutoff_window,
    sync_customer_access,
)
from services.whatsapp_service import ensure_do_number

router = APIRouter(prefix="/orders", tags=["Customer Orders"])


class OrderSessionRequest(BaseModel):
    delivery_date: date


class CustomerCancelRequest(BaseModel):
    edit_session_id: Optional[str] = None
    expected_order_version: Optional[int] = None
    reason: Optional[str] = "客户自行取消"


def _get_customer_and_access(db: Session, customer_id: int) -> tuple[Customer, dict]:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    access = sync_customer_access(db, customer)
    return customer, access


def _access_payload(customer: Customer, access: dict) -> dict:
    return {
        "is_blocked": access["is_blocked"],
        "effective_is_blocked": access["effective_is_blocked"],
        "block_source": access["block_source"],
        "block_reason": access["block_reason"],
        "blocked_at": access["blocked_at"],
        "temporary_access_active": access["temporary_access_active"],
        "temporary_access_started_at": access["temporary_access_started_at"],
        "temporary_access_until": access["temporary_access_until"],
        "temporary_access_reason": customer.temporary_access_reason,
        "max_order_delivery_date": (
            access["max_order_delivery_date"].isoformat()
            if access["max_order_delivery_date"] else None
        ),
        "overdue_amount": access["overdue_amount"],
        "outstanding_balance": access["outstanding_balance"],
        "oldest_overdue_due_date": (
            access["oldest_overdue_due_date"].isoformat()
            if access["oldest_overdue_due_date"] else None
        ),
    }


def _snapshot_payload(snapshot: dict[tuple[int, str, int], int]) -> list[dict]:
    return [
        {
            "meal_section_id": key[0],
            f"{key[1]}_id": key[2],
            "quantity": quantity,
        }
        for key, quantity in sorted(snapshot.items())
    ]


def _validate_customer_window(
    db: Session,
    customer_id: int,
    delivery_date: date,
    edit_session_id: str | None,
) -> tuple[dict, OrderEditSession | None]:
    window = order_cutoff_window(delivery_date)
    if window["is_delivery_day_or_past"]:
        raise HTTPException(status_code=409, detail="配送当天或过去日期不能由顾客下单、修改或取消，请联系客服处理")
    if window["phase"] == "closed":
        raise HTTPException(status_code=409, detail="该配送日期已超过下午 6:10 的提交宽限期，请联系客服处理")
    if window["phase"] == "open" and not edit_session_id:
        return window, None
    if not edit_session_id:
        raise HTTPException(status_code=409, detail="下单时间已截止；只有下午 6:00 前开始的操作可在 6:10 前提交")

    session = (
        db.query(OrderEditSession)
        .filter(
            OrderEditSession.id == edit_session_id,
            OrderEditSession.customer_id == customer_id,
            OrderEditSession.delivery_date == delivery_date,
        )
        .with_for_update()
        .first()
    )
    if not session or session.used_at is not None:
        raise HTTPException(status_code=409, detail="本次提交资格无效或已使用，请联系客服处理")
    if window["phase"] == "open":
        return window, session
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    cutoff_at = datetime.fromisoformat(window["cutoff_at"]).astimezone(timezone.utc)
    if started_at.astimezone(timezone.utc) >= cutoff_at:
        raise HTTPException(status_code=409, detail="本次操作并非在下午 6:00 前开始，不能使用宽限期")
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at.astimezone(timezone.utc):
        raise HTTPException(status_code=409, detail="本次提交资格已于下午 6:10 失效，请联系客服处理")
    return window, session

@router.get("/customer-profile/{customer_id}", dependencies=[Depends(require_customer_access)])
def get_customer_profile(customer_id: int, db: Session = Depends(get_db)):
    """
    客户专用：查询自身公司资料（账期、联系信息等），
    无需管理员权限，避免客户端调用 /admin/customers
    """
    customer, access = _get_customer_and_access(db, customer_id)
    db.commit()
    
    sites = db.query(DeliverySite).filter(DeliverySite.customer_id == customer_id).all()
    return {
        "id": customer.id,
        "company_name": customer.company_name,
        "company_reg_no": customer.company_reg_no,
        "phone": customer.phone,
        "company_address": customer.company_address,
        "contact_name": customer.contact_name,
        "billing_cycle": customer.billing_cycle,
        "bank_name": customer.bank_name,
        "bank_account_no": customer.bank_account_no,
        "email": customer.email,
        "tax_number": customer.tax_number,
        "access_status": _access_payload(customer, access),
        "sites": [{"id": s.id, "site_name": s.site_name, "address": s.address} for s in sites]
    }


@router.get("/access-status/{customer_id}", dependencies=[Depends(require_customer_access)])
def get_customer_access_status(customer_id: int, db: Session = Depends(get_db)):
    customer, access = _get_customer_and_access(db, customer_id)
    db.commit()
    return _access_payload(customer, access)


@router.get("/order-window", dependencies=[Depends(require_customer_access)])
def get_order_window(customer_id: int, delivery_date: date):
    return order_cutoff_window(delivery_date)


@router.post("/start-session", dependencies=[Depends(require_customer_access)])
def start_order_session(
    customer_id: int,
    req: OrderSessionRequest,
    db: Session = Depends(get_db),
):
    customer, access = _get_customer_and_access(db, customer_id)
    window = order_cutoff_window(req.delivery_date)
    if window["is_delivery_day_or_past"]:
        raise HTTPException(status_code=409, detail="配送当天或过去日期不能由顾客自行操作")
    if window["phase"] != "open":
        raise HTTPException(status_code=409, detail="该配送日期已截止，无法开始新的下单或修改操作")
    if access["temporary_access_active"] and access["max_order_delivery_date"]:
        if req.delivery_date > access["max_order_delivery_date"]:
            raise HTTPException(
                status_code=409,
                detail=f"临时开放期间仅可订购未来 {TEMP_ACCESS_DELIVERY_DAYS} 天内的配送日期",
            )

    cutoff = datetime.fromisoformat(window["cutoff_at"])
    expires = datetime.fromisoformat(window["grace_deadline"])
    session = OrderEditSession(
        id=str(uuid4()),
        customer_id=customer.id,
        delivery_date=req.delivery_date,
        started_at=malaysia_now().astimezone(timezone.utc),
        expires_at=expires.astimezone(timezone.utc),
    )
    db.add(session)
    db.commit()
    return {
        **window,
        "edit_session_id": session.id,
        "started_at": session.started_at.astimezone(MALAYSIA_TZ).isoformat(),
        "cutoff_at": cutoff.isoformat(),
    }


@router.post("/matrix-submit", response_model=List[OrderResponse])
def submit_matrix_orders(
    customer_id: int,
    req: OrderCreateMatrix,
    request: Request,
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_customer_access)
):
    """
    订餐员矩阵提报 API (兼容 GSP 多工厂早9点报数、pro3c 当日微调、EPG 日常报数)
    """
    if _auth.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="后台代客下单请使用管理员订单接口并填写操作原因")

    customer, access = _get_customer_and_access(db, customer_id)
    db.commit()
    window, edit_session = _validate_customer_window(
        db, customer_id, req.delivery_date, req.edit_session_id
    )
    if access["temporary_access_active"] and access["max_order_delivery_date"]:
        if req.delivery_date > access["max_order_delivery_date"]:
            raise HTTPException(
                status_code=409,
                detail=f"临时开放期间仅可订购未来 {TEMP_ACCESS_DELIVERY_DAYS} 天内的配送日期",
            )

    # 2. 按 delivery_site_id 分组构建订单
    site_group = {}
    for item in req.items:
        if item.quantity <= 0:
            continue
        s_id = item.delivery_site_id
        if s_id not in site_group:
            site_group[s_id] = []
        site_group[s_id].append(item)

    if not site_group:
        raise HTTPException(status_code=400, detail="请至少选择一份餐食；如需取消整张订单，请使用订单记录中的取消功能")

    created_orders = []

    try:
        for site_id, items in site_group.items():
            # 校验站点归属
            site = db.query(DeliverySite).filter(DeliverySite.id == site_id, DeliverySite.customer_id == customer_id).first()
            if not site:
                raise HTTPException(status_code=400, detail=f"配送站点 ID {site_id} 不存在或不属于该客户")

            existing_order = db.query(Order).filter(
                Order.customer_id == customer_id,
                Order.delivery_site_id == site_id,
                Order.delivery_date == req.delivery_date,
                Order.status != "cancelled",
            ).with_for_update().first()

            if existing_order and existing_order.status != "submitted":
                raise HTTPException(status_code=409, detail="该订单已进入处理流程，请联系客服修改")
            if existing_order:
                if req.expected_order_version is None:
                    raise HTTPException(status_code=409, detail="该日期已有订单，请从订单记录进入修改，避免覆盖现有内容")
                if existing_order.version != req.expected_order_version:
                    raise HTTPException(status_code=409, detail="订单已被其他人员修改，请刷新后重新操作")

            assigned_rows = db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == customer_id).all()
            assigned_sections = {row.meal_section_id: row.meal_section for row in assigned_rows}
            customer_packages = db.query(CustomerPackage).filter(
                CustomerPackage.customer_id == customer_id,
                CustomerPackage.is_active == True,
                CustomerPackage.is_shown_to_customer == True,
            ).all()
            packages_by_template = {row.package_template_id: row for row in customer_packages}
            customer_addons = db.query(CustomerAddon).join(AddonTemplate).filter(
                CustomerAddon.customer_id == customer_id,
                AddonTemplate.is_customer_visible == True,
            ).all()
            addons_by_id = {row.id: row for row in customer_addons}

            old_snapshot = {}
            if existing_order:
                for detail in existing_order.details:
                    if detail.customer_package:
                        key = (detail.meal_section_id, "package_template", detail.customer_package.package_template_id)
                        old_snapshot[key] = old_snapshot.get(key, 0) + detail.quantity
                    elif detail.customer_addon:
                        key = (detail.meal_section_id, "customer_addon", detail.customer_addon_id)
                        old_snapshot[key] = old_snapshot.get(key, 0) + detail.quantity

            new_snapshot = {}
            for item in items:
                section = assigned_sections.get(item.meal_section_id)
                if not section:
                    raise HTTPException(status_code=400, detail=f"餐次 ID {item.meal_section_id} 未向该客户开放")
                has_package = item.customer_package_id is not None
                has_addon = item.customer_addon_id is not None
                if has_package == has_addon:
                    raise HTTPException(status_code=400, detail="每项订单明细必须且只能选择套餐或 Add-on")

                if has_package:
                    cp = packages_by_template.get(item.customer_package_id)
                    if not cp:
                        raise HTTPException(status_code=400, detail="所选套餐未向该客户开放或已隐藏")
                    allowed_categories = effective_meal_section_categories(section)
                    if cp.template.category not in allowed_categories:
                        raise HTTPException(status_code=400, detail="所选套餐不属于该餐次允许的分类")
                    key = (item.meal_section_id, "package_template", item.customer_package_id)
                else:
                    addon = addons_by_id.get(item.customer_addon_id)
                    parent_cp = packages_by_template.get(item.parent_package_id)
                    if not addon or not parent_cp:
                        raise HTTPException(status_code=400, detail="所选 Add-on 或对应套餐未向该客户开放")
                    if not any(link.customer_package_id == parent_cp.id for link in addon.package_links):
                        raise HTTPException(status_code=400, detail="该 Add-on 未向所选客户专属套餐开放")
                    key = (item.meal_section_id, "customer_addon", item.customer_addon_id)
                new_snapshot[key] = new_snapshot.get(key, 0) + item.quantity

            if access["effective_is_blocked"]:
                if not existing_order:
                    raise HTTPException(status_code=403, detail="账户因到期欠款被冻结，不能新增订单；请清还欠款或联系客服临时开通")
                if any(qty > old_snapshot.get(key, 0) for key, qty in new_snapshot.items()):
                    raise HTTPException(status_code=403, detail="冻结期间只能减少现有订单数量，不能新增餐品或增加数量")

            if existing_order:
                db.query(OrderDetail).filter(OrderDetail.order_id == existing_order.id).delete()
                order = existing_order
                order.version = (order.version or 1) + 1
                order.updated_at = datetime.now(timezone.utc)
                is_new_order = False
            else:
                order = Order(
                    customer_id=customer_id,
                    delivery_site_id=site_id,
                    delivery_date=req.delivery_date,
                    status="submitted",
                    version=1,
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(order)
                db.flush()
                ensure_do_number(order)
                is_new_order = True

            for item in items:
                if item.customer_package_id is not None:
                    cp = packages_by_template[item.customer_package_id]
                    detail = OrderDetail(
                        order_id=order.id,
                        meal_section_id=item.meal_section_id,
                        customer_package_id=cp.id,
                        quantity=item.quantity,
                        final_unit_price=cp.agreement_price,
                        remark=item.remark,
                    )
                else:
                    addon = addons_by_id[item.customer_addon_id]
                    detail = OrderDetail(
                        order_id=order.id,
                        meal_section_id=item.meal_section_id,
                        customer_addon_id=addon.id,
                        quantity=item.quantity,
                        final_unit_price=addon.agreement_price,
                        remark=item.remark,
                    )
                db.add(detail)
            created_orders.append(order)

            write_audit_log(
                db=db,
                action_type=AUDIT_ACTION_ORDER_CREATE if is_new_order else AUDIT_ACTION_ORDER_UPDATE,
                description=(f"客户创建了新订单 #{order.id}" if is_new_order else f"客户修改了订单 #{order.id} 的信息"),
                operator_name=_auth.get("name") or customer.company_name,
                operator_role="customer",
                target_id=order.id,
                target_label=f"{customer.company_name} | {req.delivery_date}",
                extra_data={
                    "before": _snapshot_payload(old_snapshot),
                    "after": _snapshot_payload(new_snapshot),
                    "cutoff_at": window["cutoff_at"],
                    "grace_submission": window["phase"] == "grace",
                    "edit_session_id": req.edit_session_id,
                    "restriction_mode": "reduce_only" if access["effective_is_blocked"] else "full",
                },
            )

        if edit_session:
            edit_session.used_at = datetime.now(timezone.utc)
            if len(created_orders) == 1:
                edit_session.order_id = created_orders[0].id
        order_ids = [order.id for order in created_orders]
        db.commit()
        created_orders = db.query(Order).filter(Order.id.in_(order_ids)).all()

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"订单提报失败: {str(e)}")

    # 转换响应格式
    response_list = []
    for order in created_orders:
        site = db.query(DeliverySite).filter(DeliverySite.id == order.delivery_site_id).first()
        details_resp = []
        for d in order.details:
            pkg_name = d.customer_package.template.name if d.customer_package else None
            addon_name = d.customer_addon.template.name if d.customer_addon else None
            meal_name = d.meal_section.name if d.meal_section else ""
            details_resp.append(OrderDetailResponse(
                id=d.id,
                meal_section_name=meal_name,
                package_name=pkg_name,
                addon_name=addon_name,
                quantity=d.quantity,
                remark=d.remark
            ))

        response_list.append(OrderResponse(
            id=order.id,
            do_number=order.do_number,
            customer_id=order.customer_id,
            company_name=customer.company_name,
            delivery_site_id=order.delivery_site_id,
            site_name=site.site_name if site else "",
            delivery_date=order.delivery_date,
            status=order.status,
            remark=order.remark,
            details=details_resp,
            created_at=order.created_at
        ))

    return response_list


@router.post("/{order_id}/cancel", dependencies=[Depends(require_customer_access)])
def cancel_customer_order(
    order_id: int,
    customer_id: int,
    req: CustomerCancelRequest,
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_customer_access),
):
    if _auth.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="后台取消订单请使用管理员接口并填写原因")
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == customer_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "submitted":
        raise HTTPException(status_code=409, detail="订单已进入处理流程，请联系客服取消")
    if req.expected_order_version is not None and order.version != req.expected_order_version:
        raise HTTPException(status_code=409, detail="订单已被其他人员修改，请刷新后再试")

    window, edit_session = _validate_customer_window(db, customer_id, order.delivery_date, req.edit_session_id)
    old_status = order.status
    order.status = "cancelled"
    order.version = (order.version or 1) + 1
    order.updated_at = datetime.now(timezone.utc)
    if edit_session:
        edit_session.used_at = datetime.now(timezone.utc)
        edit_session.order_id = order.id

    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_ORDER_CANCEL,
        description=f"客户取消了订单 #{order.id}",
        operator_name=_auth.get("name") or order.customer.company_name,
        operator_role="customer",
        target_id=order.id,
        target_label=f"{order.customer.company_name} | {order.delivery_date}",
        extra_data={
            "changes": [{"field": "订单状态", "old": old_status, "new": "cancelled"}],
            "reason": req.reason or "客户自行取消",
            "cutoff_at": window["cutoff_at"],
            "grace_submission": window["phase"] == "grace",
        },
    )
    db.commit()
    return {"message": "订单已取消", "order_id": order.id, "status": order.status}

@router.get("/customer-history/{customer_id}", dependencies=[Depends(require_customer_access)])
def get_customer_order_history(customer_id: int, db: Session = Depends(get_db)):
    """
    订餐员查看自己的历史订单（不展示价格）
    """
    customer, access = _get_customer_and_access(db, customer_id)
    balance_by_order = {row["order_id"]: row for row in access["order_balances"]}
    orders = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.delivery_date.desc()).all()
    results = []
    for order in orders:
        details_list = []
        for d in order.details:
            pkg_name = d.customer_package.template.name if d.customer_package else None
            addon_name = d.customer_addon.template.name if d.customer_addon else None
            meal_name = d.meal_section.name if d.meal_section else ""
            raw_detail_remark = d.remark or ""
            parent_match = re.search(r"\[addon_for_package:(\d+)\]", raw_detail_remark)
            parent_package_id = int(parent_match.group(1)) if parent_match else None
            display_remark = re.sub(r"\s*\[addon_for_package:\d+\]\s*", " ", raw_detail_remark).strip() or None
            details_list.append({
                "id": d.id,
                "meal_section_id": d.meal_section_id,
                "meal_section": meal_name,
                "meal_section_name": meal_name,
                "package_name": pkg_name,
                "addon_name": addon_name,
                "customer_package_id": d.customer_package.template.id if d.customer_package and d.customer_package.template else None,
                "customer_addon_id": d.customer_addon_id,
                "parent_package_id": parent_package_id,
                "quantity": d.quantity,
                "remark": display_remark
            })
        window = order_cutoff_window(order.delivery_date)
        financial = balance_by_order.get(order.id)
        can_start_action = order.status == "submitted" and window["phase"] == "open" and not window["is_delivery_day_or_past"]
        results.append({
            "id": order.id,
            "do_number": order.do_number,
            "delivery_date": order.delivery_date.strftime("%Y-%m-%d"),
            "site_name": order.site.site_name,
            "site_id": order.delivery_site_id,
            "status": order.status,
            "remark": order.remark,
            "version": order.version or 1,
            "financial_status": ({
                "due_date": financial["due_date"].isoformat(),
                "is_overdue": financial["is_overdue"],
                "is_paid": financial["outstanding"] <= 0.005,
                "outstanding_amount": financial["outstanding"],
            } if financial else None),
            "details": details_list,
            "customer_actions": {
                "can_modify": can_start_action,
                "can_cancel": can_start_action,
                "restriction_mode": "reduce_only" if access["effective_is_blocked"] else "full",
                "cutoff_at": window["cutoff_at"],
                "grace_deadline": window["grace_deadline"],
            },
        })
    db.commit()
    return results


@router.get("/meal-sections", dependencies=[Depends(require_customer_access)])
def get_meal_sections_public(customer_id: int, db: Session = Depends(get_db)):
    """
    客户端专用：获取当前客户开通的下单餐次，并返回每个餐次允许的公共/专属套餐及对应单价
    """
    # 1. 查找该客户开通的餐次关联
    assigned = db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == customer_id).all()
    assigned_section_ids = [item.meal_section_id for item in assigned]

    # 2. 拉取开通的餐次详细信息
    sections = db.query(MealSection).filter(MealSection.id.in_(assigned_section_ids)).order_by(MealSection.sort_order.asc(), MealSection.id.asc()).all()
    
    # 3. 只返回管理员已明确指派、启用且允许顾客看到的套餐。
    #    提交端使用相同的白名单，避免页面显示了实际无法提交的套餐。
    cust_pkgs = db.query(CustomerPackage).filter(
        CustomerPackage.customer_id == customer_id,
        CustomerPackage.is_active == True,
        CustomerPackage.is_shown_to_customer == True,
    ).all()
    customer_addons = db.query(CustomerAddon).join(AddonTemplate).filter(
        CustomerAddon.customer_id == customer_id,
        AddonTemplate.is_customer_visible == True,
    ).all()

    results = []
    for s in sections:
        # 防止后台误把午餐/大型供餐分类绑定到早餐，导致客户在错误餐次下单。
        allowed_cats = sorted(effective_meal_section_categories(s))
        
        section_packages = []
        for cp in cust_pkgs:
            t = cp.template
            if not t or t.category not in allowed_cats:
                continue

            section_packages.append({
                # 返回前端时，ID 依然为套餐模板 ID
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "price": cp.agreement_price,
                "description": t.description,
                "addons": [
                    {
                        "id": addon.id,
                        "name": addon.template.name,
                        "price": addon.agreement_price,
                        "description": addon.template.description,
                    }
                    for addon in customer_addons
                    if any(link.customer_package_id == cp.id for link in addon.package_links)
                ],
            })

        results.append({
            "id": s.id,
            "name": s.name,
            "sort_order": s.sort_order,
            "allowed_categories": ",".join(allowed_cats),
            "packages": section_packages
        })
        
    return results


