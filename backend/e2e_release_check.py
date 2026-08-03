"""Isolated release smoke test. Never points at the production database."""
import hashlib
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

test_db = Path(tempfile.gettempdir()) / "central_kitchen_release_check.db"
if test_db.exists():
    test_db.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{test_db.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "release-check-secret-not-for-production"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["AUTO_CREATE_SCHEMA"] = "false"
os.environ["SEED_DEMO_DATA"] = "false"

from fastapi.testclient import TestClient
from database import Base, SessionLocal, engine
from main import app
from model.models import Customer, CustomerMealSection, CustomerPackage, CustomerUser, DeliverySite, MealSection, PackageTemplate, StaffUser

def legacy_hash(password: str) -> str:
    return hashlib.sha256((password + "central_kitchen_salt_2026").encode("utf-8")).hexdigest()

Base.metadata.create_all(bind=engine)
db = SessionLocal()
admin = StaffUser(username="admin@test", password_hash=legacy_hash("AdminPass123!"), full_name="Admin", role="superadmin", is_active=True)
customer_one = Customer(company_name="Customer One", contact_name="One")
customer_two = Customer(company_name="Customer Two", contact_name="Two")
db.add_all([admin, customer_one, customer_two])
db.commit()
site = DeliverySite(customer_id=customer_one.id, site_name="Plant A", address="Test address")
customer_user_one = CustomerUser(customer_id=customer_one.id, username="one@test", password_hash=legacy_hash("CustomerPass123!"), contact_name="One")
customer_user_two = CustomerUser(customer_id=customer_two.id, username="two@test", password_hash=legacy_hash("CustomerPass123!"), contact_name="Two")
section = MealSection(name="Lunch", sort_order=1, allowed_categories="Meal")
package = PackageTemplate(name="Test Meal", category="Meal", default_price=12.5)
inactive_package = PackageTemplate(name="Inactive Test Meal", category="Meal", default_price=9.5)
db.add_all([site, customer_user_one, customer_user_two, section, package, inactive_package])
db.commit()
db.add_all([
    CustomerMealSection(customer_id=customer_one.id, meal_section_id=section.id),
    CustomerPackage(customer_id=customer_one.id, package_template_id=package.id, agreement_price=12.5, is_active=True, is_shown_to_customer=True),
    CustomerPackage(customer_id=customer_two.id, package_template_id=inactive_package.id, agreement_price=9.5, is_active=False, is_shown_to_customer=False),
])
db.commit()
customer_one_id = customer_one.id
customer_two_id = customer_two.id
site_id = site.id
section_id = section.id
package_id = package.id
inactive_package_id = inactive_package.id
db.close()

client = TestClient(app)

def login(username: str, password: str) -> dict:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

assert client.get("/admin/customers").status_code == 401
admin_headers = login("admin@test", "AdminPass123!")
customer_headers = login("one@test", "CustomerPass123!")
other_customer_headers = login("two@test", "CustomerPass123!")

db = SessionLocal()
assert db.query(StaffUser).filter_by(username="admin@test").one().password_hash.startswith("$pbkdf2-sha256$")
db.close()

created_package_response = client.post(
    "/admin/packages",
    headers=admin_headers,
    json={
        "name": "Created Through API",
        "category": "Meal",
        "default_price": 15.0,
        "description": "Audit regression check",
    },
)
assert created_package_response.status_code == 200, created_package_response.text
package_create_audit = client.get(
    "/admin/audit-logs?action_type=PACKAGE_TEMPLATE_CREATE",
    headers=admin_headers,
)
assert package_create_audit.status_code == 200, package_create_audit.text
assert package_create_audit.json()["total"] == 1
assert package_create_audit.json()["items"][0]["target_label"] == "Created Through API"

active_package_delete = client.delete(f"/admin/packages/{package_id}", headers=admin_headers)
assert active_package_delete.status_code == 409, active_package_delete.text
assert active_package_delete.json()["detail"]["code"] == "package_has_active_customers"
assert active_package_delete.json()["detail"]["customers"] == ["Customer One"]

inactive_package_delete = client.delete(f"/admin/packages/{inactive_package_id}", headers=admin_headers)
assert inactive_package_delete.status_code == 409, inactive_package_delete.text
assert inactive_package_delete.json()["detail"]["code"] == "package_has_inactive_customers"
assert inactive_package_delete.json()["detail"]["customers"] == ["Customer Two"]
cleanup_inactive_package = client.delete(
    f"/admin/packages/{inactive_package_id}?cleanup_inactive=true",
    headers=admin_headers,
)
assert cleanup_inactive_package.status_code == 200, cleanup_inactive_package.text
package_delete_audit = client.get(
    "/admin/audit-logs?action_type=PACKAGE_TEMPLATE_DELETE",
    headers=admin_headers,
)
assert package_delete_audit.status_code == 200, package_delete_audit.text
assert package_delete_audit.json()["total"] == 1
assert package_delete_audit.json()["items"][0]["target_label"] == "Inactive Test Meal"

assigned_section_delete = client.delete(f"/admin/meal-sections/{section_id}", headers=admin_headers)
assert assigned_section_delete.status_code == 409, assigned_section_delete.text
assert "仍已分配给客户" in assigned_section_delete.json()["detail"]

assert client.get(f"/orders/customer-profile/{customer_one_id}", headers=other_customer_headers).status_code == 403
assert client.get(f"/orders/customer-profile/{customer_one_id}", headers=customer_headers).status_code == 200
assert client.get("/admin/customers", headers=customer_headers).status_code == 403

order_response = client.post(
    f"/orders/matrix-submit?customer_id={customer_one_id}",
    headers=customer_headers,
    json={"delivery_date": str(date.today() + timedelta(days=2)), "items": [{"delivery_site_id": site_id, "meal_section_id": section_id, "customer_package_id": package_id, "quantity": 8, "remark": "release check"}]},
)
assert order_response.status_code == 200, order_response.text
order_id = order_response.json()[0]["id"]

status_response = client.put(
    f"/admin/orders/{order_id}/status",
    headers=admin_headers,
    json={"status": "confirmed", "reason": "Release check confirmation", "expected_order_version": 1},
)
assert status_response.status_code == 200, status_response.text
payment_response = client.post(
    "/admin/payments",
    headers=admin_headers,
    json={"customer_id": customer_one_id, "payment_date": str(date.today()), "amount": 100.0, "payment_method": "Bank Transfer", "do_ids": [order_id]},
)
assert payment_response.status_code == 200, payment_response.text
assert client.get(f"/admin/payments?customer_id={customer_one_id}", headers=admin_headers).status_code == 200

db = SessionLocal()
customer_package = db.query(CustomerPackage).filter_by(package_template_id=package_id).one()
customer_package.is_active = False
db.commit()
db.close()
historical_package_delete = client.delete(f"/admin/packages/{package_id}", headers=admin_headers)
assert historical_package_delete.status_code == 409, historical_package_delete.text
assert historical_package_delete.json()["detail"]["code"] == "package_has_order_history"
package_delete_audit = client.get(
    "/admin/audit-logs?action_type=PACKAGE_TEMPLATE_DELETE",
    headers=admin_headers,
)
assert package_delete_audit.json()["total"] == 1

print("PASS: auth, authorization, customer ordering, admin confirmation, and payment recording")
engine.dispose()
test_db.unlink(missing_ok=True)
