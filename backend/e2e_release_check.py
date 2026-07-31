"""Isolated release smoke test. Never points at the production database."""
import hashlib
import os
import tempfile
from datetime import date
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
db.add_all([site, customer_user_one, customer_user_two, section, package])
db.commit()
db.add_all([
    CustomerMealSection(customer_id=customer_one.id, meal_section_id=section.id),
    CustomerPackage(customer_id=customer_one.id, package_template_id=package.id, agreement_price=12.5, is_active=True, is_shown_to_customer=True),
])
db.commit()
customer_one_id = customer_one.id
customer_two_id = customer_two.id
site_id = site.id
section_id = section.id
package_id = package.id
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

assert client.get(f"/orders/customer-profile/{customer_one_id}", headers=other_customer_headers).status_code == 403
assert client.get(f"/orders/customer-profile/{customer_one_id}", headers=customer_headers).status_code == 200
assert client.get("/admin/customers", headers=customer_headers).status_code == 403

order_response = client.post(
    f"/orders/matrix-submit?customer_id={customer_one_id}",
    headers=customer_headers,
    json={"delivery_date": str(date.today()), "items": [{"delivery_site_id": site_id, "meal_section_id": section_id, "customer_package_id": package_id, "quantity": 8, "remark": "release check"}]},
)
assert order_response.status_code == 200, order_response.text
order_id = order_response.json()[0]["id"]

status_response = client.put(f"/admin/orders/{order_id}/status?status=confirmed", headers=admin_headers)
assert status_response.status_code == 200, status_response.text
payment_response = client.post(
    "/admin/payments",
    headers=admin_headers,
    json={"customer_id": customer_one_id, "payment_date": str(date.today()), "amount": 100.0, "payment_method": "Bank Transfer", "do_ids": [order_id]},
)
assert payment_response.status_code == 200, payment_response.text
assert client.get(f"/admin/payments?customer_id={customer_one_id}", headers=admin_headers).status_code == 200

print("PASS: auth, authorization, customer ordering, admin confirmation, and payment recording")
engine.dispose()
test_db.unlink(missing_ok=True)
