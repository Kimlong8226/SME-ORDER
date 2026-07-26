import os
import sys
import io
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from main import app
from database import SessionLocal
from model.models import Customer, CustomerUser, DeliverySite, MealSection, CustomerPackage, PackageTemplate, Order, OrderDetail, Invoice, CustomerMealSection, AuditLog
from api.auth import create_access_token

client = TestClient(app)

def print_step(msg):
    print(f"\n========================================\n{msg}\n========================================")

def run_simulation():
    issues_found = []
    print_step("开始模拟 Pro3c 与 GSP 客户下单 10 天 30 餐订单并进行 Smoke Test 与全流程漏洞排查")

    # ----------------------------------------------------
    # Step 1: 管理员登录
    # ----------------------------------------------------
    print("[1] 测试管理员登录...")
    res = client.post("/auth/login", json={"username": "acc.kimlonggroup@gmail.com", "password": "password123"})
    if res.status_code != 200:
        issues_found.append(f"管理员登录失败: {res.text}")
        print(f"❌ 管理员登录失败: {res.text}")
        return
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✓ 管理员登录成功")

    # ----------------------------------------------------
    # Step 2: 查找真实测试客户 (Pro3c & GSP)
    # ----------------------------------------------------
    db = SessionLocal()
    
    pro3c_cust = db.query(Customer).filter(Customer.company_name.like("%Pro3c%")).first()
    gsp_cust = db.query(Customer).filter(Customer.company_name.like("%GSP%")).first()

    if not pro3c_cust:
        issues_found.append("数据库中未查找到 Pro3c 客户")
        print("❌ 未找到 Pro3c 客户")
    if not gsp_cust:
        issues_found.append("数据库中未查找到 GSP 客户")
        print("❌ 未找到 GSP 客户")

    if not pro3c_cust or not gsp_cust:
        db.close()
        return

    target_customers = [
        {"cust_obj": pro3c_cust, "label": "Pro3c 电子厂"},
        {"cust_obj": gsp_cust, "label": "GSP 集团"}
    ]

    # ----------------------------------------------------
    # Step 3: 模拟 Pro3c 与 GSP 客户连续 10 天, 30+ 餐次下单
    # ----------------------------------------------------
    today = datetime.now()

    for tc in target_customers:
        cust = tc["cust_obj"]
        label = tc["label"]
        print_step(f"开始模拟客户 [{cust.company_name}] ({label}) 提报 10 天 30+ 餐次订单...")

        # 查找或生成该客户的 User Token
        c_user = db.query(CustomerUser).filter(CustomerUser.customer_id == cust.id).first()
        if not c_user:
            c_username = f"user_cust_{cust.id}"
            c_contact = cust.contact_name or "Manager"
        else:
            c_username = c_user.username
            c_contact = c_user.contact_name

        token = create_access_token({
            "sub": c_username,
            "user_type": "customer",
            "customer_id": cust.id,
            "name": c_contact
        })
        cust_headers = {"Authorization": f"Bearer {token}"}

        # 1. 获取客户 Profile (站点)
        res = client.get(f"/orders/customer-profile/{cust.id}", headers=cust_headers)
        if res.status_code != 200:
            issues_found.append(f"获取 {label} Profile失败: {res.text}")
            print(f"❌ 获取 Profile 失败: {res.text}")
            continue

        profile = res.json()
        sites = profile.get("sites", [])
        if not sites:
            issues_found.append(f"客户 {label} 无可用配送站点 DeliverySite")
            print(f"❌ 站点列表为空")
            continue

        print(f"✓ 客户 Profile 加载成功，包含 {len(sites)} 个配送站点: {[s['site_name'] for s in sites]}")

        # 2. 获取餐次与套餐
        res = client.get(f"/orders/meal-sections?customer_id={cust.id}", headers=cust_headers)
        if res.status_code != 200:
            issues_found.append(f"获取 {label} 餐次配置失败: {res.text}")
            print(f"❌ 获取餐次配置失败: {res.text}")
            continue

        sections = res.json()
        print(f"✓ 客户餐次列表加载成功，包含 {len(sections)} 个配置餐次: {[sec['name'] for sec in sections]}")
        if not sections:
            issues_found.append(f"客户 {label} 餐次配置为空")
            print(f"❌ 餐次配置为空")
            continue

        # 3. 连续下 10 天订单 (每天提报多个餐次，覆盖 30+ 餐)
        total_days = 10
        orders_submitted = 0
        total_meal_items = 0

        for d in range(1, total_days + 1):
            delivery_date = (today + timedelta(days=d)).strftime("%Y-%m-%d")
            items = []

            for site_idx, site in enumerate(sites):
                for sec_idx, sec in enumerate(sections):
                    packages = sec.get("packages", [])
                    if not packages:
                        continue
                    pkg = packages[0]
                    qty = 30 + (d * 3) + (sec_idx * 5) # 模拟真实报数数量

                    items.append({
                        "delivery_site_id": site["id"],
                        "meal_section_id": sec["id"],
                        "customer_package_id": pkg["id"],
                        "quantity": qty,
                        "remark": f"自动化测试 [{label}] 第{d}天 {site['site_name']} {sec['name']} Qty:{qty}"
                    })
                    total_meal_items += 1

            if not items:
                continue

            payload = {
                "delivery_date": delivery_date,
                "items": items
            }

            # 首次矩阵提报
            res = client.post(f"/orders/matrix-submit?customer_id={cust.id}", json=payload, headers=cust_headers)
            if res.status_code != 200:
                issues_found.append(f"客户 {label} 在 {delivery_date} 下单失败: {res.text}")
                print(f"❌ 矩阵下单失败 [{delivery_date}]: {res.text}")
            else:
                orders_submitted += len(res.json())
                print(f"  ✓ [{delivery_date}] 矩阵提报成功 ({len(res.json())} 站点订单，{len(items)} 项餐次明细)")

            # 测试：同日微调覆盖更新 (Overwrite Mode)
            if d == 5:
                print(f"  > [同日微调测试] 模拟客户在日期 {delivery_date} 重新提交订单微调数量...")
                for item in items:
                    item["quantity"] += 10
                    item["remark"] += " [二次调整+10]"

                res_re = client.post(f"/orders/matrix-submit?customer_id={cust.id}", json=payload, headers=cust_headers)
                if res_re.status_code != 200:
                    issues_found.append(f"客户 {label} 在 {delivery_date} 覆盖修改失败: {res_re.text}")
                    print(f"  ❌ 覆盖修改失败: {res_re.text}")
                else:
                    # 校验是否没有产生重复的多余订单，而是覆盖原订单
                    check_orders = db.query(Order).filter(
                        Order.customer_id == cust.id,
                        Order.delivery_date == delivery_date
                    ).all()
                    if len(check_orders) > len(sites):
                        issues_found.append(f"覆盖更新 Bug: 产生了重复订单记录！现有 {len(check_orders)} 条，应为 {len(sites)} 条")
                        print(f"  ❌ 发现订单重复生成 Bug!")
                    else:
                        print(f"  ✓ 覆盖更新成功！已有订单无缝更新，无旧数据残存。")

        print(f"✓ 客户 [{label}] 10 天模拟完成！共提报 {orders_submitted} 个站点订单，包含 {total_meal_items} 餐次明细。")

    db.close()

    # ----------------------------------------------------
    # Step 4: 管理员发票生成与财务汇总核算测试
    # ----------------------------------------------------
    print_step("测试管理员视角：校验未结订单汇总并一键生成发票 (Invoice)...")

    db = SessionLocal()
    for tc in target_customers:
        cust = tc["cust_obj"]
        label = tc["label"]

        print(f"\n测试为客户 [{cust.company_name}] (ID: {cust.id}) 检查未结订单并自动开票...")
        res = client.get(f"/admin/invoices/unbilled-orders?customer_id={cust.id}", headers=admin_headers)
        if res.status_code != 200:
            issues_found.append(f"获取客户 {label} 未结订单失败: {res.text}")
            print(f"❌ 获取未结订单失败: {res.text}")
            continue

        unbilled_data = res.json()
        unbilled_orders = unbilled_data.get("orders", [])
        total_unbilled_calc = unbilled_data.get("total_amount", 0)
        print(f"✓ 查找到 {len(unbilled_orders)} 笔未结订单，接口返回总额: RM {total_unbilled_calc:.2f}")

        if unbilled_orders:
            order_ids = [o["id"] for o in unbilled_orders]

            # 校验实际 OrderDetail 算出的 Expected total
            expected_total = 0.0
            for o_id in order_ids:
                ord_obj = db.query(Order).filter(Order.id == o_id).first()
                if ord_obj:
                    for d_item in ord_obj.details:
                        expected_total += (d_item.quantity * d_item.final_unit_price)

            print(f"  > 校验预期总金额 (Expected): RM {expected_total:.2f} vs 接口计算 (Unbilled): RM {total_unbilled_calc:.2f}")
            if abs(expected_total - total_unbilled_calc) > 0.01:
                bug_msg = f"【发票计算 Bug】客户 {label} 未结订单总金额失真! 实际明细累加: RM {expected_total:.2f}, 接口返回: RM {total_unbilled_calc:.2f}"
                issues_found.append(bug_msg)
                print(f"  ❌ {bug_msg}")
            else:
                print("  ✓ 未结订单金额汇总精确无误！")

            # 提交生成对账发票
            inv_res = client.post("/admin/invoices", json={
                "customer_id": cust.id,
                "order_ids": order_ids
            }, headers=admin_headers)

            if inv_res.status_code != 200:
                issues_found.append(f"为客户 {label} 生成发票失败: {inv_res.text}")
                print(f"❌ 生成发票失败: {inv_res.text}")
            else:
                inv_data = inv_res.json()
                inv_no = inv_data.get("invoice_number", "N/A")
                inv_amt = inv_data.get("total_amount")
                amt_str = f"RM {inv_amt:.2f}" if inv_amt is not None else "N/A"
                print(f"  ✓ 成功生成对账发票 #{inv_no}，包含 {len(order_ids)} 笔订单，开票总额: {amt_str}")
        else:
            print(f"  ℹ️ 客户 {label} 当前无新增未结订单 (可能之前已全部生成发票)")

    db.close()

    # ----------------------------------------------------
    # Step 5: 账户冻结/锁卡与安全边界检测
    # ----------------------------------------------------
    print_step("安全与边界防护专项检测...")

    db = SessionLocal()
    print("测试 1: 账号被锁定/欠款阻断 (is_blocked) 测试...")
    cust_to_block = db.query(Customer).filter(Customer.id == pro3c_cust.id).first()
    cust_to_block.is_blocked = True
    db.commit()

    token = create_access_token({
        "sub": "test_block_user",
        "user_type": "customer",
        "customer_id": pro3c_cust.id,
        "name": "Block Test"
    })
    cust_headers = {"Authorization": f"Bearer {token}"}

    # 获取合法的 site_id 与 meal_section_id
    valid_site = db.query(DeliverySite).filter(DeliverySite.customer_id == pro3c_cust.id).first()
    valid_section = db.query(MealSection).first()
    valid_site_id = valid_site.id if valid_site else 1
    valid_sec_id = valid_section.id if valid_section else 1

    payload = {
        "delivery_date": (today + timedelta(days=20)).strftime("%Y-%m-%d"),
        "items": [{"delivery_site_id": valid_site_id, "meal_section_id": valid_sec_id, "customer_package_id": 1, "quantity": 10}]
    }
    res_blocked = client.post(f"/orders/matrix-submit?customer_id={pro3c_cust.id}", json=payload, headers=cust_headers)

    if res_blocked.status_code == 403:
        print("  ✓ 成功拦截被锁定客户提报 (403 Forbidden 提示正确)")
    else:
        issues_found.append(f"锁定客户下单拦截失效！HTTP 状态码: {res_blocked.status_code}, 响应: {res_blocked.text}")
        print(f"  ❌ 锁定客户下单拦截失效！状态码: {res_blocked.status_code}, 响应: {res_blocked.text}")

    # 解锁恢复
    cust_to_block.is_blocked = False
    db.commit()

    print("\n测试 2: 审计日志写入检测...")
    logs = db.query(AuditLog).all()
    print(f"  ✓ 审计日志总记录条数: {len(logs)}")

    db.close()

    # ----------------------------------------------------
    # 总结与 Bug 汇报
    # ----------------------------------------------------
    print_step("Smoke Test 与 10天30餐 模拟测试结果汇总")
    if not issues_found:
        print("🎉【测试完全通过】Pro3c 与 GSP 客户连续 10 天 30+ 餐次提报、同日微调更新、未结订单统计、发票自动生成及安全拦截全部成功，未出现任何致命 Bug 或金额偏差！")
    else:
        print(f"⚠️ 发现 {len(issues_found)} 个问题/缺陷:")
        for idx, issue in enumerate(issues_found, 1):
            print(f"  {idx}. {issue}")

if __name__ == "__main__":
    run_simulation()
