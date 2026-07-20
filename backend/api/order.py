from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from database import get_db
from model.models import Order, OrderDetail, Customer, CustomerUser, CustomerPackage, MealSection, DeliverySite, CustomerMealSection, PackageTemplate
from schema.schemas import OrderCreateMatrix, OrderResponse, OrderDetailResponse

router = APIRouter(prefix="/orders", tags=["Customer Orders"])

@router.get("/customer-profile/{customer_id}")
def get_customer_profile(customer_id: int, db: Session = Depends(get_db)):
    """
    客户专用：查询自身公司资料（账期、联系信息等），
    无需管理员权限，避免客户端调用 /admin/customers
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    
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
        "sites": [{"id": s.id, "site_name": s.site_name, "address": s.address} for s in sites]
    }


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
            unit_price = 0.0
            chosen_cp_id = None
            
            if item.customer_package_id:
                # 传入的 item.customer_package_id 实际上是公共 PackageTemplate.id
                # 1. 查找是否存在已指派的专属协议套餐
                cp = db.query(CustomerPackage).filter(
                    CustomerPackage.customer_id == customer_id,
                    CustomerPackage.package_template_id == item.customer_package_id,
                    CustomerPackage.is_active == True
                ).first()
                
                if cp:
                    chosen_cp_id = cp.id
                    unit_price = cp.agreement_price
                else:
                    # 2. 如果之前没有开通指派，为了外键约束，我们自动开通一条默认价格的专属记录
                    template = db.query(PackageTemplate).filter(PackageTemplate.id == item.customer_package_id).first()
                    if template:
                        new_cp = CustomerPackage(
                            customer_id=customer_id,
                            package_template_id=template.id,
                            agreement_price=template.default_price,
                            is_active=True,
                            is_shown_to_customer=True
                        )
                        db.add(new_cp)
                        db.commit()
                        db.refresh(new_cp)
                        chosen_cp_id = new_cp.id
                        unit_price = new_cp.agreement_price

            detail = OrderDetail(
                order_id=order.id,
                meal_section_id=item.meal_section_id,
                customer_package_id=chosen_cp_id,
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


@router.get("/meal-sections")
def get_meal_sections_public(customer_id: int, db: Session = Depends(get_db)):
    """
    客户端专用：获取当前客户开通的下单餐次，并返回每个餐次允许的公共/专属套餐及对应单价
    """
    # 1. 查找该客户开通的餐次关联
    assigned = db.query(CustomerMealSection).filter(CustomerMealSection.customer_id == customer_id).all()
    assigned_section_ids = [item.meal_section_id for item in assigned]

    # 2. 拉取开通的餐次详细信息
    sections = db.query(MealSection).filter(MealSection.id.in_(assigned_section_ids)).order_by(MealSection.sort_order.asc(), MealSection.id.asc()).all()
    
    # 3. 查找该客户已有的专属价格（用于价格匹配）
    cust_pkgs = db.query(CustomerPackage).filter(CustomerPackage.customer_id == customer_id, CustomerPackage.is_active == True).all()
    cust_pkg_map = {cp.package_template_id: cp for cp in cust_pkgs}

    results = []
    for s in sections:
        allowed_cats = [cat.strip() for cat in s.allowed_categories.split(",") if cat.strip()]
        
        # 从公共 PackageTemplate 中找出所有分类匹配的套餐
        templates = db.query(PackageTemplate).filter(PackageTemplate.category.in_(allowed_cats)).all()
        
        section_packages = []
        for t in templates:
            # 检查是否有专属配置
            cp = cust_pkg_map.get(t.id)
            
            # 如果专属配置里被管理员勾选了隐藏，则对客户端隐藏
            if cp and not cp.is_shown_to_customer:
                continue
                
            # 获取价格：优先协议价，其次默认价
            price = cp.agreement_price if cp else t.default_price
            
            section_packages.append({
                # 返回前端时，ID 依然为套餐模板 ID
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "price": price,
                "description": t.description
            })

        results.append({
            "id": s.id,
            "name": s.name,
            "sort_order": s.sort_order,
            "packages": section_packages
        })
        
    return results


