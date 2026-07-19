from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from database import get_db
from model.models import Order, OrderDetail, Customer, CustomerUser, CustomerPackage, MealSection, DeliverySite
from schema.schemas import OrderCreateMatrix, OrderResponse, OrderDetailResponse

router = APIRouter(prefix="/orders", tags=["Customer Orders"])

@router.post("/matrix-submit", response_model=List[OrderResponse])
def submit_matrix_orders(
    customer_id: int,
    req: OrderCreateMatrix,
    db: Session = Depends(get_db)
):
    """
    订餐员矩阵提报 API (兼容 GSP 多工厂早9点报数、pro3c 当日微调、EPG 日常报数)
    """
    # 1. 拦截暂停下单客户 (欠款未付款锁定)
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    if customer.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您的账号已被系统限制下单，请联系财务核对账款"
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

    created_orders = []

    for site_id, items in site_group.items():
        # 查找当天的现有订单（如果已存在则进行更新或覆盖）
        existing_order = db.query(Order).filter(
            Order.customer_id == customer_id,
            Order.delivery_site_id == site_id,
            Order.delivery_date == req.delivery_date
        ).first()

        if existing_order:
            # 删除旧明细重新写入（覆盖修改模式）
            db.query(OrderDetail).filter(OrderDetail.order_id == existing_order.id).delete()
            order = existing_order
            order.status = "submitted"
        else:
            order = Order(
                customer_id=customer_id,
                delivery_site_id=site_id,
                delivery_date=req.delivery_date,
                status="submitted"
            )
            db.add(order)
            db.commit()
            db.refresh(order)

        for item in items:
            cp = db.query(CustomerPackage).filter(CustomerPackage.id == item.customer_package_id).first() if item.customer_package_id else None
            unit_price = cp.agreement_price if cp else 0.0

            detail = OrderDetail(
                order_id=order.id,
                meal_section_id=item.meal_section_id,
                customer_package_id=item.customer_package_id,
                quantity=item.quantity,
                final_unit_price=unit_price,
                remark=item.remark
            )
            db.add(detail)

        db.commit()
        db.refresh(order)
        created_orders.append(order)

    # 转换响应格式
    response_list = []
    for order in created_orders:
        site = db.query(DeliverySite).filter(DeliverySite.id == order.delivery_site_id).first()
        details_resp = []
        for d in order.details:
            pkg_name = d.customer_package.template.name if d.customer_package else "未知"
            meal_name = d.meal_section.name if d.meal_section else ""
            details_resp.append(OrderDetailResponse(
                id=d.id,
                meal_section_name=meal_name,
                package_name=pkg_name,
                quantity=d.quantity,
                remark=d.remark
            ))

        response_list.append(OrderResponse(
            id=order.id,
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

@router.get("/customer-history/{customer_id}")
def get_customer_order_history(customer_id: int, db: Session = Depends(get_db)):
    """
    订餐员查看自己的历史订单（不展示价格）
    """
    orders = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.delivery_date.desc()).all()
    results = []
    for order in orders:
        details_list = []
        for d in order.details:
            pkg_name = d.customer_package.template.name if d.customer_package else "未知"
            meal_name = d.meal_section.name if d.meal_section else ""
            details_list.append({
                "meal_section": meal_name,
                "package_name": pkg_name,
                "quantity": d.quantity,
                "remark": d.remark
            })
        results.append({
            "id": order.id,
            "delivery_date": order.delivery_date.strftime("%Y-%m-%d"),
            "site_name": order.site.site_name,
            "status": order.status,
            "details": details_list
        })
    return results
