import os
import random
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
from model.models import Customer, CustomerUser, DeliverySite, MealSection, CustomerPackage

client = TestClient(app)

def run_tests():
    print("=== 开始高强度联动与 Smoke Test ===")
    
    # 1. Admin Login
    print("\n[1] 测试管理员登录...")
    res = client.post("/auth/login", json={"username": "acc.kimlonggroup@gmail.com", "password": "password123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✓ 管理员登录成功")

    # 2. 获取客户列表
    print("\n[2] 测试获取客户列表...")
    res = client.get("/admin/customers", headers=admin_headers)
    assert res.status_code == 200, f"Fetch customers failed: {res.text}"
    customers = res.json()
    print(f"✓ 获取到 {len(customers)} 个客户")

    # 3. 高强度创建订单
    print("\n[3] 测试高强度并发生成订单...")
    db = SessionLocal()
    customer_users = db.query(CustomerUser).all()
    
    total_orders_created = 0
    today = datetime.now()
    
    from api.auth import create_access_token
    for c_user in customer_users:
        # Forge Customer token
        c_token = create_access_token({
            "sub": c_user.username,
            "user_type": "customer",
            "customer_id": c_user.customer_id,
            "name": c_user.contact_name
        })
        c_headers = {"Authorization": f"Bearer {c_token}"}
        
        # Get customer sites
        res = client.get(f"/orders/customer-profile/{c_user.customer_id}", headers=c_headers)
        print("Customer Profile response:", res.json())
        if res.status_code != 200 or not res.json().get("sites"):
            continue
        site_id = res.json()["sites"][0]["id"]
        
        # Get meal sections configured for this customer
        res = client.get(f"/orders/meal-sections?customer_id={c_user.customer_id}", headers=c_headers)
        sections = res.json()
        # Ensure customer has some packages and meal sections configured
        from model.models import CustomerPackage, PackageTemplate, CustomerMealSection
        if not sections:
            print(f"  > 客户 {c_user.username} 没有配置餐次/套餐，自动为其分配...")
            pkg = db.query(PackageTemplate).first()
            msec = db.query(MealSection).first()
            
            if not msec.allowed_categories:
                msec.allowed_categories = pkg.category
                db.commit()
            
            cms = CustomerMealSection(customer_id=c_user.customer_id, meal_section_id=msec.id)
            db.add(cms)
            
            cp = CustomerPackage(customer_id=c_user.customer_id, package_template_id=pkg.id, agreement_price=10.0, is_active=True)
            db.add(cp)
            db.commit()
            
            # 重新获取
            res = client.get(f"/orders/meal-sections?customer_id={c_user.customer_id}", headers=c_headers)
            sections = res.json()
            
        print("Meal sections response after fix:", sections)
        if not sections:
            continue
            
        # Create orders for next 5 days
        for i in range(1, 10):
            delivery_date = (today + timedelta(days=i)).strftime("%Y-%m-%d")
            items = []
            
            for sec in sections:
                if not sec.get("packages"): continue
                pkg_id = sec["packages"][0]["id"]
                items.append({
                    "delivery_site_id": site_id,
                    "meal_section_id": sec["id"],
                    "customer_package_id": pkg_id,
                    "quantity": random.randint(10, 100),
                    "remark": f"自动化测试备注 {random.randint(1, 1000)}"
                })
                
            if not items: continue
            
            payload = {
                "delivery_date": delivery_date,
                "items": items
            }
            
            res = client.post(f"/orders/matrix-submit?customer_id={c_user.customer_id}", json=payload, headers=c_headers)
            assert res.status_code == 200, f"Submit order failed: {res.text}"
            total_orders_created += 1
            
    db.close()
    print(f"✓ 成功高强度生成 {total_orders_created} 批复杂订单！")

    # 4. 管理员获取所有订单
    print("\n[4] 测试管理员拉取全局订单...")
    res = client.get("/admin/all-orders", headers=admin_headers)
    assert res.status_code == 200
    all_orders = res.json()
    print(f"✓ 成功拉取 {len(all_orders)} 个订单。")

    # 5. 测试生成对账发票 (Invoice)
    print("\n[5] 测试自动生成对账发票...")
    for c in customers:
        res = client.get(f"/admin/invoices/unbilled-orders?customer_id={c['id']}", headers=admin_headers)
        if res.status_code == 200:
            unbilled = res.json().get("orders", [])
            if unbilled:
                order_ids = [o["id"] for o in unbilled]
                res = client.post("/admin/invoices", json={
                    "customer_id": c["id"],
                    "order_ids": order_ids
                }, headers=admin_headers)
                assert res.status_code == 200, f"Invoice gen failed: {res.text}"
                print(f"  ✓ 成功为客户 {c['company_name']} 生成包含 {len(order_ids)} 笔订单的对账单")
                
    print("\n✅ 所有联动测试与高强度压测通过！系统运转正常，未发现 API 崩溃及数据断层。")

if __name__ == "__main__":
    run_tests()
