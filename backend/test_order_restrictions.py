import os
import unittest
from datetime import date, datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from database import Base, get_db
from main import app
from api.auth import create_access_token
from api.order_rules import (
    MALAYSIA_TZ,
    calculate_customer_financials,
    calculate_customers_financials,
    malaysia_now,
    order_cutoff_window,
    sync_customer_access,
    temporary_access_expiry,
)
from model.models import (
    Customer,
    CustomerPackage,
    CustomerMealSection,
    DeliverySite,
    MealSection,
    Order,
    OrderDetail,
    PackageTemplate,
    PaymentRecord,
)


class OrderRestrictionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.customer = Customer(company_name="Test Customer", billing_cycle="7", is_blocked=False)
        self.site = DeliverySite(customer=self.customer, site_name="Main", address="Test")
        template = PackageTemplate(name="Meal", category="饭盒", default_price=10)
        package = CustomerPackage(customer=self.customer, template=template, agreement_price=10, is_active=True)
        section = MealSection(name="午餐", sort_order=1)
        self.db.add_all([self.customer, self.site, template, package, section])
        self.db.flush()
        self.package = package
        self.section = section

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_order(self, delivery_date: date, quantity: int) -> Order:
        order = Order(
            customer_id=self.customer.id,
            delivery_site_id=self.site.id,
            delivery_date=delivery_date,
            status="submitted",
            version=1,
        )
        self.db.add(order)
        self.db.flush()
        self.db.add(OrderDetail(
            order_id=order.id,
            meal_section_id=self.section.id,
            customer_package_id=self.package.id,
            quantity=quantity,
            final_unit_price=10,
        ))
        self.db.flush()
        return order

    def test_cutoff_and_ten_minute_grace(self):
        delivery = date(2026, 8, 1)
        self.assertEqual(order_cutoff_window(delivery, datetime(2026, 7, 31, 17, 59, tzinfo=MALAYSIA_TZ))["phase"], "open")
        self.assertEqual(order_cutoff_window(delivery, datetime(2026, 7, 31, 18, 0, tzinfo=MALAYSIA_TZ))["phase"], "grace")
        self.assertEqual(order_cutoff_window(delivery, datetime(2026, 7, 31, 18, 10, tzinfo=MALAYSIA_TZ))["phase"], "grace")
        self.assertEqual(order_cutoff_window(delivery, datetime(2026, 7, 31, 18, 10, 1, tzinfo=MALAYSIA_TZ))["phase"], "closed")

    def test_temporary_access_uses_two_calendar_days(self):
        opened = datetime(2026, 7, 31, 23, 50, tzinfo=MALAYSIA_TZ)
        expiry = temporary_access_expiry(opened).astimezone(MALAYSIA_TZ)
        self.assertEqual(expiry.date(), date(2026, 8, 1))
        self.assertEqual((expiry.hour, expiry.minute, expiry.second), (23, 59, 59))

    def test_fifo_payments_only_leave_unpaid_overdue_balance(self):
        self.add_order(date(2026, 7, 1), 10)  # RM100, due 8 July
        self.add_order(date(2026, 8, 18), 10)  # RM100, still within terms
        self.db.add(PaymentRecord(customer_id=self.customer.id, payment_date=date(2026, 8, 10), amount=60))
        self.db.add(PaymentRecord(customer_id=self.customer.id, payment_date=date(2026, 8, 21), amount=999))
        self.db.commit()

        result = calculate_customer_financials(self.db, self.customer, date(2026, 8, 20))
        self.assertEqual(result["outstanding_balance"], 140)
        self.assertEqual(result["overdue_amount"], 40)
        self.assertEqual(result["oldest_overdue_due_date"], date(2026, 7, 8))

    def test_batched_financials_match_single_customer_calculation(self):
        self.add_order(date(2026, 7, 1), 10)
        self.db.add(PaymentRecord(customer_id=self.customer.id, payment_date=date(2026, 8, 10), amount=60))
        second_customer = Customer(company_name="No Orders", billing_cycle="14", is_blocked=False)
        self.db.add(second_customer)
        self.db.commit()

        current_date = date(2026, 8, 20)
        expected = calculate_customer_financials(self.db, self.customer, current_date)
        batched = calculate_customers_financials(
            self.db,
            [self.customer, second_customer],
            current_date,
        )

        self.assertEqual(batched[self.customer.id], expected)
        self.assertEqual(batched[second_customer.id]["outstanding_balance"], 0)
        self.assertEqual(batched[second_customer.id]["overdue_amount"], 0)

    def test_overdue_auto_freezes_then_payment_auto_unfreezes(self):
        self.add_order(date(2026, 7, 1), 10)
        self.db.commit()

        frozen = sync_customer_access(
            self.db,
            self.customer,
            datetime(2026, 8, 20, 9, 0, tzinfo=MALAYSIA_TZ),
        )
        self.assertTrue(frozen["effective_is_blocked"])
        self.assertEqual(self.customer.block_source, "overdue")
        self.customer.temporary_access_started_at = datetime(2026, 8, 20, 9, 0, tzinfo=timezone.utc)
        self.customer.temporary_access_until = datetime(2026, 8, 21, 15, 59, tzinfo=timezone.utc)
        self.customer.temporary_access_reason = "Temporary access before settlement"

        self.db.add(PaymentRecord(customer_id=self.customer.id, payment_date=date(2026, 8, 20), amount=100))
        self.db.flush()
        active = sync_customer_access(
            self.db,
            self.customer,
            datetime(2026, 8, 20, 9, 1, tzinfo=MALAYSIA_TZ),
        )
        self.assertFalse(active["effective_is_blocked"])
        self.assertFalse(self.customer.is_blocked)
        self.assertIsNone(self.customer.temporary_access_until)

    def test_manual_block_is_not_auto_removed(self):
        self.customer.is_blocked = True
        self.customer.block_source = "manual"
        self.customer.block_reason = "Manual safety hold"
        self.db.commit()
        result = sync_customer_access(
            self.db,
            self.customer,
            datetime(2026, 8, 20, 9, 0, tzinfo=MALAYSIA_TZ),
        )
        self.assertTrue(result["effective_is_blocked"])
        self.assertEqual(self.customer.block_source, "manual")


class OrderRestrictionApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        customer = Customer(company_name="API Customer", billing_cycle="30", is_blocked=False)
        site = DeliverySite(customer=customer, site_name="Plant", address="Test")
        template = PackageTemplate(name="API Meal", category="饭盒", default_price=12)
        package = CustomerPackage(customer=customer, template=template, agreement_price=12, is_active=True, is_shown_to_customer=True)
        section = MealSection(name="早班午餐", sort_order=1, allowed_categories="饭盒")
        self.db.add_all([customer, site, template, package, section])
        self.db.flush()
        self.db.add(CustomerMealSection(customer_id=customer.id, meal_section_id=section.id))
        self.db.commit()
        self.customer_id = customer.id
        self.site_id = site.id
        self.template_id = template.id
        self.customer_package_id = package.id
        self.section_id = section.id

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        customer_token = create_access_token({
            "sub": "api_customer",
            "user_type": "customer",
            "role": "customer",
            "name": "API Orderer",
            "customer_id": self.customer_id,
        })
        staff_token = create_access_token({
            "sub": "api_staff",
            "user_type": "staff",
            "role": "staff",
            "name": "API Staff",
        })
        super_token = create_access_token({
            "sub": "api_super",
            "user_type": "staff",
            "role": "superadmin",
            "name": "API Super",
        })
        self.customer_headers = {"Authorization": f"Bearer {customer_token}"}
        self.staff_headers = {"Authorization": f"Bearer {staff_token}"}
        self.super_headers = {"Authorization": f"Bearer {super_token}"}

    def tearDown(self):
        app.dependency_overrides.clear()
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def test_customer_submit_cancel_and_admin_restriction_history(self):
        delivery = malaysia_now().date() + timedelta(days=2)
        session_res = self.client.post(
            f"/orders/start-session?customer_id={self.customer_id}",
            json={"delivery_date": delivery.isoformat()},
            headers=self.customer_headers,
        )
        self.assertEqual(session_res.status_code, 200, session_res.text)

        submit_res = self.client.post(
            f"/orders/matrix-submit?customer_id={self.customer_id}",
            json={
                "delivery_date": delivery.isoformat(),
                "edit_session_id": session_res.json()["edit_session_id"],
                "items": [{
                    "delivery_site_id": self.site_id,
                    "meal_section_id": self.section_id,
                    "customer_package_id": self.template_id,
                    "quantity": 5,
                }],
            },
            headers=self.customer_headers,
        )
        self.assertEqual(submit_res.status_code, 200, submit_res.text)
        order_id = submit_res.json()[0]["id"]

        replay_res = self.client.post(
            f"/orders/matrix-submit?customer_id={self.customer_id}",
            json={
                "delivery_date": delivery.isoformat(),
                "edit_session_id": session_res.json()["edit_session_id"],
                "expected_order_version": 1,
                "items": [{
                    "delivery_site_id": self.site_id,
                    "meal_section_id": self.section_id,
                    "customer_package_id": self.template_id,
                    "quantity": 4,
                }],
            },
            headers=self.customer_headers,
        )
        self.assertEqual(replay_res.status_code, 409)

        cancel_session = self.client.post(
            f"/orders/start-session?customer_id={self.customer_id}",
            json={"delivery_date": delivery.isoformat()},
            headers=self.customer_headers,
        ).json()["edit_session_id"]
        cancel_res = self.client.post(
            f"/orders/{order_id}/cancel?customer_id={self.customer_id}",
            json={"edit_session_id": cancel_session, "expected_order_version": 1, "reason": "API test cancellation"},
            headers=self.customer_headers,
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.text)
        cancel_logs = self.client.get(
            f"/admin/orders/{order_id}/audit-logs",
            headers=self.staff_headers,
        )
        self.assertEqual(cancel_logs.status_code, 200, cancel_logs.text)
        self.assertTrue(any(log["action_type"] == "ORDER_CANCEL" for log in cancel_logs.json()))

        block_res = self.client.put(
            f"/admin/customers/{self.customer_id}/order-access",
            json={"action": "block", "reason": "API manual safety hold"},
            headers=self.staff_headers,
        )
        self.assertEqual(block_res.status_code, 200, block_res.text)
        temp_res = self.client.put(
            f"/admin/customers/{self.customer_id}/order-access",
            json={"action": "temporary_open", "reason": "Approved short exception"},
            headers=self.staff_headers,
        )
        self.assertEqual(temp_res.status_code, 200, temp_res.text)
        self.assertTrue(temp_res.json()["temporary_access_active"])
        temporary_until = datetime.fromisoformat(temp_res.json()["temporary_access_until"])
        self.assertEqual(temporary_until.astimezone(MALAYSIA_TZ).date(), malaysia_now().date() + timedelta(days=1))
        within_week = self.client.post(
            f"/orders/start-session?customer_id={self.customer_id}",
            json={"delivery_date": (malaysia_now().date() + timedelta(days=7)).isoformat()},
            headers=self.customer_headers,
        )
        self.assertEqual(within_week.status_code, 200, within_week.text)
        outside_week = self.client.post(
            f"/orders/start-session?customer_id={self.customer_id}",
            json={"delivery_date": (malaysia_now().date() + timedelta(days=8)).isoformat()},
            headers=self.customer_headers,
        )
        self.assertEqual(outside_week.status_code, 409, outside_week.text)

        history_res = self.client.get(
            f"/admin/customers/{self.customer_id}/restriction-history",
            headers=self.staff_headers,
        )
        self.assertEqual(history_res.status_code, 200, history_res.text)
        self.assertGreaterEqual(len(history_res.json()), 2)

    def test_customer_menu_only_exposes_assigned_visible_packages(self):
        unassigned = PackageTemplate(name="Not assigned", category="饭盒", default_price=8)
        hidden_template = PackageTemplate(name="Hidden", category="饭盒", default_price=9)
        hidden_package = CustomerPackage(
            customer_id=self.customer_id,
            template=hidden_template,
            agreement_price=9,
            is_active=True,
            is_shown_to_customer=False,
        )
        self.db.add_all([unassigned, hidden_template, hidden_package])
        self.db.commit()

        response = self.client.get(
            f"/orders/meal-sections?customer_id={self.customer_id}",
            headers=self.customer_headers,
        )
        self.assertEqual(response.status_code, 200, response.text)
        package_ids = {
            package["id"]
            for section in response.json()
            for package in section["packages"]
        }
        self.assertIn(self.template_id, package_ids)
        self.assertNotIn(unassigned.id, package_ids)
        self.assertNotIn(hidden_template.id, package_ids)

    def test_admin_customer_list_and_dashboard_stats(self):
        customers = self.client.get("/admin/customers", headers=self.staff_headers)
        self.assertEqual(customers.status_code, 200, customers.text)
        self.assertEqual(len(customers.json()), 1)
        self.assertEqual(customers.json()[0]["sites"][0]["id"], self.site_id)

        dashboard = self.client.get("/admin/dashboard-stats", headers=self.staff_headers)
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        self.assertEqual(dashboard.json()["total_customers"], 1)
        self.assertEqual(dashboard.json()["today_orders_count"], 0)

    def test_staff_can_override_orders_but_only_superadmin_reads_global_audit(self):
        delivery = malaysia_now().date()
        create_res = self.client.post(
            "/admin/orders",
            json={
                "customer_id": self.customer_id,
                "site_id": self.site_id,
                "delivery_date": delivery.isoformat(),
                "reason": "Urgent same-day customer request",
                "items": [{
                    "meal_section_id": self.section_id,
                    "customer_package_id": self.customer_package_id,
                    "quantity": 3,
                }],
            },
            headers=self.staff_headers,
        )
        self.assertEqual(create_res.status_code, 200, create_res.text)
        self.assertTrue(create_res.json()["late_override"])
        order_id = create_res.json()["order_id"]

        bypass_approval = self.client.put(
            f"/admin/orders/{order_id}/status",
            json={"status": "in_production", "reason": "Attempt to skip approval", "expected_order_version": 1},
            headers=self.staff_headers,
        )
        self.assertEqual(bypass_approval.status_code, 409, bypass_approval.text)

        missing_reason = self.client.put(
            f"/admin/orders/{order_id}/status",
            json={"status": "confirmed", "reason": ""},
            headers=self.staff_headers,
        )
        self.assertEqual(missing_reason.status_code, 422)
        whitespace_reason = self.client.put(
            f"/admin/orders/{order_id}/status",
            json={"status": "confirmed", "reason": "   "},
            headers=self.staff_headers,
        )
        self.assertEqual(whitespace_reason.status_code, 400)
        status_res = self.client.put(
            f"/admin/orders/{order_id}/status",
            json={"status": "confirmed", "reason": "Kitchen confirmed urgent order", "expected_order_version": 1},
            headers=self.staff_headers,
        )
        self.assertEqual(status_res.status_code, 200, status_res.text)
        listed_order = next(
            row for row in self.client.get("/admin/all-orders", headers=self.staff_headers).json()
            if row["id"] == order_id
        )
        self.assertTrue(listed_order["do_number"].startswith("DO-"))

        order_audit = self.client.get(f"/admin/orders/{order_id}/audit-logs", headers=self.staff_headers)
        self.assertEqual(order_audit.status_code, 200, order_audit.text)
        self.assertGreaterEqual(len(order_audit.json()), 2)
        self.assertEqual(self.client.get("/admin/audit-logs", headers=self.staff_headers).status_code, 403)
        self.assertEqual(self.client.get("/admin/audit-logs", headers=self.super_headers).status_code, 200)
        self.assertEqual(self.client.get("/admin/whatsapp/settings", headers=self.staff_headers).status_code, 403)
        self.assertEqual(self.client.get("/admin/whatsapp/settings", headers=self.super_headers).status_code, 200)

    def test_frozen_customer_can_reduce_but_not_increase_existing_order(self):
        delivery = malaysia_now().date() + timedelta(days=2)
        first_session = self.client.post(
            f"/orders/start-session?customer_id={self.customer_id}",
            json={"delivery_date": delivery.isoformat()},
            headers=self.customer_headers,
        ).json()["edit_session_id"]
        create_res = self.client.post(
            f"/orders/matrix-submit?customer_id={self.customer_id}",
            json={
                "delivery_date": delivery.isoformat(),
                "edit_session_id": first_session,
                "items": [{
                    "delivery_site_id": self.site_id,
                    "meal_section_id": self.section_id,
                    "customer_package_id": self.template_id,
                    "quantity": 5,
                }],
            },
            headers=self.customer_headers,
        )
        self.assertEqual(create_res.status_code, 200, create_res.text)

        self.assertEqual(self.client.put(
            f"/admin/customers/{self.customer_id}/order-access",
            json={"action": "block", "reason": "Credit control review"},
            headers=self.staff_headers,
        ).status_code, 200)
        edit_session = self.client.post(
            f"/orders/start-session?customer_id={self.customer_id}",
            json={"delivery_date": delivery.isoformat()},
            headers=self.customer_headers,
        ).json()["edit_session_id"]
        base_payload = {
            "delivery_date": delivery.isoformat(),
            "edit_session_id": edit_session,
            "expected_order_version": 1,
            "items": [{
                "delivery_site_id": self.site_id,
                "meal_section_id": self.section_id,
                "customer_package_id": self.template_id,
                "quantity": 6,
            }],
        }
        increase = self.client.post(
            f"/orders/matrix-submit?customer_id={self.customer_id}",
            json=base_payload,
            headers=self.customer_headers,
        )
        self.assertEqual(increase.status_code, 403, increase.text)
        base_payload["items"][0]["quantity"] = 4
        reduce = self.client.post(
            f"/orders/matrix-submit?customer_id={self.customer_id}",
            json=base_payload,
            headers=self.customer_headers,
        )
        self.assertEqual(reduce.status_code, 200, reduce.text)


if __name__ == "__main__":
    unittest.main()
