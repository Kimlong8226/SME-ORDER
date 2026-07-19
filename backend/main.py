import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, timedelta

from database import engine, Base, SessionLocal
from model.models import (
    StaffUser, Customer, CustomerUser, DeliverySite, PackageTemplate,
    MealSection, Order, OrderDetail, CustomerPackage, Invoice
)
from api import auth, admin, order
from api.auth import get_password_hash

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="金龙中央厨房伙食下单系统 API",
    description="KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(order.router)

def seed_data():
    db = SessionLocal()
    try:
        sections = [
            ("早餐", 1),
            ("早班午餐", 2),
            ("早班晚餐", 3),
            ("客户/顾问加餐饭盒", 4),
            ("夜班餐食 10pm Buffet", 5),
            ("夜班餐食 3am 宵夜", 6),
        ]
        for name, sort_order in sections:
            existing = db.query(MealSection).filter(MealSection.name == name).first()
            if not existing:
                db.add(MealSection(name=name, sort_order=sort_order))
        db.commit()

        if not db.query(StaffUser).filter(StaffUser.username == "admin").first():
            db.add(StaffUser(
                username="admin",
                password_hash=get_password_hash("admin123"),
                full_name="超级管理员",
                role="superadmin",
                is_active=True
            ))

        if not db.query(StaffUser).filter(StaffUser.username == "staff").first():
            db.add(StaffUser(
                username="staff",
                password_hash=get_password_hash("staff123"),
                full_name="运营小李",
                role="staff",
                is_active=True
            ))
        db.commit()

        packages = [
            ("标准员工早餐", "早餐", 5.0, "炒面/米粉/面包 + 饮料"),
            ("日式饭盒", "饭盒", 18.0, "包含照烧鸡排/三文鱼、米饭、日式小菜"),
            ("饭盒 (2菜1肉1水果)", "饭盒", 13.0, "标准员工午/晚餐饭盒"),
            ("高蛋白饭盒 (2肉1菜1水果)", "饭盒", 15.0, "高蛋白员工餐"),
            ("大型供餐 (2肉2菜1汤1水果)", "大型供餐", 22.0, "适合高管及贵宾桌餐"),
            ("Buffet 10pm 自助餐", "Buffet", 28.0, "夜班保温桶畅饮自助餐模式"),
            ("3am 宵夜套餐", "宵夜", 12.0, "夜班凌晨3点补充餐"),
        ]
        pkg_obj_map = {}
        for name, category, price, desc in packages:
            pkg = db.query(PackageTemplate).filter(PackageTemplate.name == name).first()
            if not pkg:
                pkg = PackageTemplate(name=name, category=category, default_price=price, description=desc)
                db.add(pkg)
                db.commit()
                db.refresh(pkg)
            pkg_obj_map[name] = pkg

        customers_seed = [
            {
                "username": "gsp_order",
                "pass": "123456",
                "company_name": "GSP 集团",
                "reg_no": "20240100888",
                "phone": "+60 12-777 8899",
                "contact": "王总管",
                "sites": ["tmn tek 工厂", "sinergy 分部", "idaman 园区", "ulu choh 厂区"],
                "billing_cycle": "30"
            },
            {
                "username": "epg_order",
                "pass": "123456",
                "company_name": "EPG 有限公司",
                "reg_no": "20240100999",
                "phone": "+60 16-888 6622",
                "contact": "佐藤经理",
                "sites": ["EPG 主厂区"],
                "billing_cycle": "14"
            },
            {
                "username": "pro3c_order",
                "pass": "123456",
                "company_name": "pro3c 电子厂",
                "reg_no": "20240100777",
                "phone": "+60 19-333 4455",
                "contact": "周主管 (中国组)",
                "sites": ["pro3c A栋", "pro3c B栋车间"],
                "billing_cycle": "30"
            },
            {
                "username": "yilian_order",
                "pass": "123456",
                "company_name": "易联软件厂家",
                "reg_no": "20240100555",
                "phone": "+60 11-2233 4455",
                "contact": "林经理",
                "sites": ["易联软件研发大楼"],
                "billing_cycle": "30"
            }
        ]

        cust_obj_map = {}
        for cdata in customers_seed:
            cust = db.query(Customer).filter(Customer.company_name == cdata["company_name"]).first()
            if not cust:
                cust = Customer(
                    company_name=cdata["company_name"],
                    company_reg_no=cdata["reg_no"],
                    phone=cdata["phone"],
                    contact_name=cdata["contact"],
                    billing_cycle=cdata["billing_cycle"],
                    company_address=f"Johor Bahru, Malaysia ({cdata['company_name']} Headquarters)",
                    bank_name="Maybank",
                    bank_account_no="8009182736"
                )
                db.add(cust)
                db.commit()
                db.refresh(cust)

                db.add(CustomerUser(
                    customer_id=cust.id,
                    username=cdata["username"],
                    password_hash=get_password_hash(cdata["pass"]),
                    contact_name=cdata["contact"]
                ))
                for sname in cdata["sites"]:
                    db.add(DeliverySite(
                        customer_id=cust.id,
                        site_name=sname,
                        address=f"Industrial Zone, {sname}",
                        contact_person=cdata["contact"],
                        phone=cdata["phone"]
                    ))
                db.commit()

                for pkg_name, pkg_obj in pkg_obj_map.items():
                    db.add(CustomerPackage(
                        customer_id=cust.id,
                        package_template_id=pkg_obj.id,
                        agreement_price=17.0 if cdata["company_name"] == "EPG 有限公司" and pkg_name == "日式饭盒" else (pkg_obj.default_price - 1.0)
                    ))
                db.commit()

            cust_obj_map[cdata["company_name"]] = cust

        # MealSection
        m_breakfast = db.query(MealSection).filter(MealSection.name == "早餐").first()
        m_lunch = db.query(MealSection).filter(MealSection.name == "早班午餐").first()
        m_dinner = db.query(MealSection).filter(MealSection.name == "早班晚餐").first()
        m_extra = db.query(MealSection).filter(MealSection.name == "客户/顾问加餐饭盒").first()
        m_buffet = db.query(MealSection).filter(MealSection.name == "夜班餐食 10pm Buffet").first()
        m_supper = db.query(MealSection).filter(MealSection.name == "夜班餐食 3am 宵夜").first()

        # 录入 EPG 7月13日~7月19日 真实日式便当与加饭数据
        epg_cust = cust_obj_map["EPG 有限公司"]
        epg_site = db.query(DeliverySite).filter(DeliverySite.customer_id == epg_cust.id).first()
        epg_jp_pkg = db.query(CustomerPackage).filter(CustomerPackage.customer_id == epg_cust.id).first()

        epg_schedule = [
            ("2026-07-13", 50, "加饭 5 份 (日式便当标准配餐)"),
            ("2026-07-14", 52, "加饭 5 份"),
            ("2026-07-15", 55, "加饭 10 份 (部门开会)"),
            ("2026-07-16", 50, "加饭 5 份"),
            ("2026-07-17", 48, "加饭 5 份"),
            ("2026-07-18", 35, "周末减量加饭 3 份"),
            ("2026-07-19", 30, "周末减量加饭 3 份"),
        ]

        for dt_str, qty, rmk in epg_schedule:
            d_obj = date.fromisoformat(dt_str)
            existing_ord = db.query(Order).filter(Order.customer_id == epg_cust.id, Order.delivery_date == d_obj).first()
            if not existing_ord and epg_site and epg_jp_pkg:
                ord_inst = Order(
                    customer_id=epg_cust.id,
                    delivery_site_id=epg_site.id,
                    delivery_date=d_obj,
                    status="submitted"
                )
                db.add(ord_inst)
                db.commit()
                db.refresh(ord_inst)

                db.add(OrderDetail(
                    order_id=ord_inst.id,
                    meal_section_id=m_lunch.id,
                    customer_package_id=epg_jp_pkg.id,
                    quantity=qty,
                    final_unit_price=17.0,
                    remark=rmk
                ))
                db.commit()

        # GSP 数据
        gsp_cust = cust_obj_map["GSP 集团"]
        gsp_site = db.query(DeliverySite).filter(DeliverySite.customer_id == gsp_cust.id).first()
        gsp_pkg = db.query(CustomerPackage).filter(CustomerPackage.customer_id == gsp_cust.id).first()

        gsp_weekly_schedule = [
            ("2026-07-13", 71, 40, 76, 3, 0, 42, 40),
            ("2026-07-14", 71, 42, 77, 3, 1, 44, 42),
            ("2026-07-15", 71, 42, 77, 6, 1, 44, 42),
            ("2026-07-16", 71, 42, 77, 3, 0, 39, 37),
            ("2026-07-17", 72, 37, 78, 0, 0, 44, 42),
            ("2026-07-18", 65, 42, 68, 0, 0, 43, 41),
            ("2026-07-19", 58, 41, 61, 0, 0, 43, 41),
        ]

        for dt_str, b_day, b_night, l_day, extra_box, rba_box, bft_10pm, sup_3am in gsp_weekly_schedule:
            d_obj = date.fromisoformat(dt_str)
            existing_ord = db.query(Order).filter(Order.customer_id == gsp_cust.id, Order.delivery_date == d_obj).first()
            if not existing_ord and gsp_site and gsp_pkg:
                order_inst = Order(
                    customer_id=gsp_cust.id,
                    delivery_site_id=gsp_site.id,
                    delivery_date=d_obj,
                    status="submitted"
                )
                db.add(order_inst)
                db.commit()
                db.refresh(order_inst)

                db.add(OrderDetail(
                    order_id=order_inst.id,
                    meal_section_id=m_breakfast.id,
                    customer_package_id=gsp_pkg.id,
                    quantity=b_day + b_night,
                    final_unit_price=gsp_pkg.agreement_price,
                    remark=f"早班{b_day}份 + 夜班{b_night}份"
                ))

                db.add(OrderDetail(
                    order_id=order_inst.id,
                    meal_section_id=m_lunch.id,
                    customer_package_id=gsp_pkg.id,
                    quantity=l_day,
                    final_unit_price=gsp_pkg.agreement_price,
                    remark="早班午/晚餐"
                ))

                if extra_box + rba_box > 0:
                    db.add(OrderDetail(
                        order_id=order_inst.id,
                        meal_section_id=m_extra.id,
                        customer_package_id=gsp_pkg.id,
                        quantity=extra_box + rba_box,
                        final_unit_price=gsp_pkg.agreement_price,
                        remark=f"客户饭盒{extra_box}份, RBA顾问饭盒{rba_box}份"
                    ))

                db.add(OrderDetail(
                    order_id=order_inst.id,
                    meal_section_id=m_buffet.id,
                    customer_package_id=gsp_pkg.id,
                    quantity=bft_10pm,
                    final_unit_price=gsp_pkg.agreement_price,
                    remark="10pm 保温桶 Buffet"
                ))

                db.add(OrderDetail(
                    order_id=order_inst.id,
                    meal_section_id=m_supper.id,
                    customer_package_id=gsp_pkg.id,
                    quantity=sup_3am,
                    final_unit_price=gsp_pkg.agreement_price,
                    remark="3am 宵夜"
                ))
                db.commit()

        # 易联软件
        yl_cust = cust_obj_map["易联软件厂家"]
        yl_site = db.query(DeliverySite).filter(DeliverySite.customer_id == yl_cust.id).first()
        yl_pkg = db.query(CustomerPackage).filter(CustomerPackage.customer_id == yl_cust.id).first()

        for i in range(13, 19):
            dt_str = f"2026-07-{i}"
            d_obj = date.fromisoformat(dt_str)
            existing_ord = db.query(Order).filter(Order.customer_id == yl_cust.id, Order.delivery_date == d_obj).first()
            if not existing_ord and yl_site and yl_pkg:
                order_inst = Order(
                    customer_id=yl_cust.id,
                    delivery_site_id=yl_site.id,
                    delivery_date=d_obj,
                    status="submitted"
                )
                db.add(order_inst)
                db.commit()
                db.refresh(order_inst)

                db.add(OrderDetail(
                    order_id=order_inst.id,
                    meal_section_id=m_breakfast.id,
                    customer_package_id=yl_pkg.id,
                    quantity=2,
                    final_unit_price=yl_pkg.agreement_price,
                    remark="易联早餐餐盒 2份"
                ))
                db.add(OrderDetail(
                    order_id=order_inst.id,
                    meal_section_id=m_lunch.id,
                    customer_package_id=yl_pkg.id,
                    quantity=2,
                    final_unit_price=yl_pkg.agreement_price,
                    remark="易联午餐餐盒 2份"
                ))
                db.commit()

        # --- Seeding Test Invoices ---
        existing_invoice = db.query(Invoice).first()
        if not existing_invoice:
            # EPG 有限公司 Invoice
            epg_cust = cust_obj_map["EPG 有限公司"]
            epg_orders = db.query(Order).filter(
                Order.customer_id == epg_cust.id,
                Order.delivery_date >= date.fromisoformat("2026-07-13"),
                Order.delivery_date <= date.fromisoformat("2026-07-17")
            ).all()
            
            if epg_orders:
                epg_total_amount = sum(sum(d.quantity * d.final_unit_price for d in o.details) for o in epg_orders)
                epg_inv = Invoice(
                    invoice_number="INV-KL-EPG-20260719001",
                    customer_id=epg_cust.id,
                    start_date=date.fromisoformat("2026-07-13"),
                    end_date=date.fromisoformat("2026-07-17"),
                    total_amount=epg_total_amount,
                    payment_status="unpaid"
                )
                db.add(epg_inv)
                db.commit()
                db.refresh(epg_inv)
                
                for o in epg_orders:
                    o.invoice_id = epg_inv.id
                    o.status = "billed"
                db.commit()

            # GSP 集团 Invoice
            gsp_cust = cust_obj_map["GSP 集团"]
            gsp_orders = db.query(Order).filter(
                Order.customer_id == gsp_cust.id,
                Order.delivery_date >= date.fromisoformat("2026-07-13"),
                Order.delivery_date <= date.fromisoformat("2026-07-16")
            ).all()
            
            if gsp_orders:
                gsp_total_amount = sum(sum(d.quantity * d.final_unit_price for d in o.details) for o in gsp_orders)
                gsp_inv = Invoice(
                    invoice_number="INV-KL-GSP-20260719002",
                    customer_id=gsp_cust.id,
                    start_date=date.fromisoformat("2026-07-13"),
                    end_date=date.fromisoformat("2026-07-16"),
                    total_amount=gsp_total_amount,
                    payment_status="paid"
                )
                db.add(gsp_inv)
                db.commit()
                db.refresh(gsp_inv)
                
                for o in gsp_orders:
                    o.invoice_id = gsp_inv.id
                    o.status = "billed"
                db.commit()

    except Exception as e:
        print(f"Seed Error: {e}")
        db.rollback()
    finally:
        db.close()

seed_data()

@app.get("/")
def read_root():
    return {
        "system": "金龙中央厨房伙食下单系统 API",
        "status": "Online",
        "currency": "RM (Malaysia Ringgit)"
    }
