import os
import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from api.admin import _validate_status_transition
from api.auth import require_superadmin
from api.whatsapp import (
    CustomerGroupUpdate,
    WhatsAppSettingsUpdate,
    update_customer_mapping,
    update_whatsapp_settings,
)
from database import Base
from model.models import (
    Customer,
    CustomerPackage,
    CustomerWhatsAppGroup,
    DeliverySite,
    MealSection,
    Order,
    OrderDetail,
    PackageTemplate,
    WhatsAppDelivery,
    WhatsAppSettings,
)
from services.whatsapp_service import (
    WhatsAppConfigurationError,
    _claim_delivery,
    apply_ack_event,
    encrypt_api_key,
    enqueue_order_message,
    ensure_do_number,
    format_delivery_message,
    process_delivery,
)


class WhatsAppDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.original_encryption_key = os.environ.get("WHATSAPP_CONFIG_ENCRYPTION_KEY")
        os.environ["WHATSAPP_CONFIG_ENCRYPTION_KEY"] = "unit-test-whatsapp-key"
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        customer = Customer(company_name="ABC COMPANY")
        self.db.add(customer)
        self.db.flush()
        site = DeliverySite(customer_id=customer.id, site_name="Factory A", address="Test address")
        meal = MealSection(name="午餐", sort_order=1)
        package = PackageTemplate(name="鸡饭套餐", category="饭盒", default_price=8.0)
        self.db.add_all([site, meal, package])
        self.db.flush()
        customer_package = CustomerPackage(
            customer_id=customer.id,
            package_template_id=package.id,
            agreement_price=8.0,
            is_active=True,
        )
        self.db.add(customer_package)
        self.db.flush()
        order = Order(
            customer_id=customer.id,
            delivery_site_id=site.id,
            delivery_date=date(2026, 8, 3),
            status="confirmed",
            version=2,
        )
        self.db.add(order)
        self.db.flush()
        ensure_do_number(order)
        self.db.add(OrderDetail(
            order_id=order.id,
            meal_section_id=meal.id,
            customer_package_id=customer_package.id,
            quantity=25,
            final_unit_price=8.0,
            remark="5份不要辣",
        ))
        self.db.add(WhatsAppSettings(
            id=1,
            gateway_url="https://gateway.example.com",
            session_name="default",
            api_key_encrypted=encrypt_api_key("test-api-key"),
            is_enabled=True,
        ))
        self.db.add(CustomerWhatsAppGroup(
            customer_id=customer.id,
            group_id="123456789@g.us",
            group_name="ABC Customer Group",
            is_enabled=True,
            show_prices=False,
            verified_at=datetime.now(timezone.utc),
        ))
        self.db.commit()
        self.order_id = order.id

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        if self.original_encryption_key is None:
            os.environ.pop("WHATSAPP_CONFIG_ENCRYPTION_KEY", None)
        else:
            os.environ["WHATSAPP_CONFIG_ENCRYPTION_KEY"] = self.original_encryption_key

    def test_do_number_is_permanent_after_delivery_date_changes(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        original = order.do_number
        order.delivery_date = date(2026, 8, 4)
        self.assertEqual(ensure_do_number(order), original)

    def test_message_uses_do_number_version_and_hides_prices(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        delivery = enqueue_order_message(
            self.db,
            order,
            event_type="confirmed",
            requested_by="Admin",
            request_reason="Approved",
        )
        message = format_delivery_message(delivery, order)
        self.assertIn(order.do_number, message)
        self.assertIn("版本：V2", message)
        self.assertIn("鸡饭套餐 × 25份", message)
        self.assertNotIn("RM ", message)

    def test_process_delivery_records_gateway_message_id(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        delivery = enqueue_order_message(
            self.db,
            order,
            event_type="confirmed",
            requested_by="Admin",
        )
        delivery_id = delivery.id
        self.db.commit()
        with patch("services.whatsapp_service._gateway_request", return_value={"id": "message-123"}):
            result = process_delivery(self.db, delivery_id)
        self.assertEqual(result.status, "sent")
        self.assertEqual(result.gateway_message_id, "message-123")
        self.assertIsNotNone(result.message_text)

    def test_delivery_claim_prevents_a_second_worker_from_sending_same_job(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        delivery = enqueue_order_message(
            self.db,
            order,
            event_type="confirmed",
            requested_by="Admin",
        )
        delivery_id = delivery.id
        self.db.commit()
        self.assertTrue(_claim_delivery(self.db, delivery_id))
        self.assertFalse(_claim_delivery(self.db, delivery_id))
        claimed = self.db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == delivery_id).first()
        self.assertEqual(claimed.attempt_count, 1)

    def test_failed_delivery_is_not_automatically_reprocessed(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        delivery = enqueue_order_message(
            self.db,
            order,
            event_type="confirmed",
            requested_by="Admin",
        )
        delivery_id = delivery.id
        self.db.commit()
        with patch("services.whatsapp_service._gateway_request", side_effect=RuntimeError("offline")):
            failed = process_delivery(self.db, delivery_id)
        self.assertEqual(failed.status, "failed")
        self.assertEqual(failed.attempt_count, 1)

        with patch("services.whatsapp_service._gateway_request") as gateway_request:
            unchanged = process_delivery(self.db, delivery_id)
        gateway_request.assert_not_called()
        self.assertEqual(unchanged.status, "failed")
        self.assertEqual(unchanged.attempt_count, 1)

    def test_manual_resend_supersedes_failed_task_for_same_version(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        first = enqueue_order_message(self.db, order, "confirmed", "Admin")
        first.status = "failed"
        manual = enqueue_order_message(
            self.db,
            order,
            "manual",
            "Admin",
            request_reason="Customer requested another copy",
            manual=True,
        )
        self.db.flush()
        self.db.refresh(first)
        self.assertEqual(first.status, "superseded")
        self.assertEqual(manual.status, "pending")
        manual_id = manual.id
        self.db.commit()
        with patch("services.whatsapp_service._gateway_request", return_value={"id": "manual-123"}):
            sent = process_delivery(self.db, manual_id)
        self.assertEqual(sent.status, "sent")
        self.assertEqual(sent.gateway_message_id, "manual-123")

    def test_group_ack_with_participant_suffix_matches_without_status_downgrade(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        delivery = enqueue_order_message(self.db, order, "confirmed", "Admin")
        delivery.status = "sent"
        delivery.gateway_message_id = "true_123456789@g.us_MESSAGE"
        self.db.commit()
        read = apply_ack_event(self.db, {
            "id": "true_123456789@g.us_MESSAGE_999@lid",
            "participant": "999@lid",
            "ackName": "READ",
        })
        self.assertEqual(read.status, "read")
        server = apply_ack_event(self.db, {
            "id": "true_123456789@g.us_MESSAGE",
            "ackName": "SERVER",
        })
        self.assertEqual(server.status, "read")

    def test_enabled_automation_blocks_missing_customer_mapping(self):
        self.db.query(CustomerWhatsAppGroup).delete()
        self.db.commit()
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        with self.assertRaises(WhatsAppConfigurationError):
            enqueue_order_message(
                self.db,
                order,
                event_type="confirmed",
                requested_by="Admin",
            )
        self.assertEqual(self.db.query(WhatsAppDelivery).count(), 0)

    def test_enabled_automation_blocks_group_until_test_send_succeeds(self):
        mapping = self.db.query(CustomerWhatsAppGroup).first()
        mapping.verified_at = None
        self.db.commit()
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        with self.assertRaises(WhatsAppConfigurationError):
            enqueue_order_message(self.db, order, "confirmed", "Admin")

    def test_mapping_change_requires_new_test_and_group_cannot_be_reused(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        pending = enqueue_order_message(self.db, order, "confirmed", "Admin")
        pending_id = pending.id
        self.db.commit()
        customer_two = Customer(company_name="SECOND COMPANY")
        self.db.add(customer_two)
        self.db.commit()
        with patch("api.whatsapp.list_gateway_groups", return_value=[
            {"group_id": "123456789@g.us", "group_name": "ABC Customer Group"},
            {"group_id": "987654321@g.us", "group_name": "New ABC Group"},
        ]):
            changed = update_customer_mapping(
                customer_id=self.db.query(Customer).filter(Customer.company_name == "ABC COMPANY").first().id,
                req=CustomerGroupUpdate(
                    group_id="987654321@g.us",
                    group_name="ignored",
                    is_enabled=True,
                    show_prices=False,
                    reason="Move to the approved replacement group",
                ),
                db=self.db,
                auth={"user_type": "staff", "role": "superadmin", "name": "Owner"},
            )
            self.assertFalse(changed["verified"])
            self.assertEqual(changed["superseded_pending_deliveries"], 1)
            old_delivery = self.db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == pending_id).first()
            self.assertEqual(old_delivery.status, "superseded")
            with self.assertRaises(HTTPException) as duplicate:
                update_customer_mapping(
                    customer_id=customer_two.id,
                    req=CustomerGroupUpdate(
                        group_id="987654321@g.us",
                        group_name="ignored",
                        is_enabled=True,
                        show_prices=False,
                        reason="Attempt duplicate customer group binding",
                    ),
                    db=self.db,
                    auth={"user_type": "staff", "role": "superadmin", "name": "Owner"},
                )
            self.assertEqual(duplicate.exception.status_code, 409)

    def test_order_status_cannot_bypass_approval_or_move_backwards(self):
        with self.assertRaises(HTTPException):
            _validate_status_transition("submitted", "in_production")
        with self.assertRaises(HTTPException):
            _validate_status_transition("delivered", "confirmed")
        with self.assertRaises(HTTPException):
            _validate_status_transition("cancelled", "confirmed")
        _validate_status_transition("submitted", "confirmed")

    def test_whatsapp_settings_permission_requires_superadmin(self):
        with self.assertRaises(HTTPException) as context:
            require_superadmin({"user_type": "staff", "role": "staff"})
        self.assertEqual(context.exception.status_code, 403)
        payload = {"user_type": "staff", "role": "superadmin", "name": "Owner"}
        self.assertEqual(require_superadmin(payload), payload)

    def test_superadmin_settings_update_never_returns_api_key(self):
        result = update_whatsapp_settings(
            WhatsAppSettingsUpdate(
                gateway_url="https://gateway.example.com",
                session_name="default",
                api_key=None,
                is_enabled=True,
            ),
            db=self.db,
            auth={"user_type": "staff", "role": "superadmin", "name": "Owner"},
        )
        self.assertTrue(result["has_api_key"])
        self.assertNotIn("api_key", result)

    def test_gateway_identity_change_invalidates_mappings_and_unsent_tasks(self):
        order = self.db.query(Order).filter(Order.id == self.order_id).first()
        pending = enqueue_order_message(self.db, order, "confirmed", "Admin")
        pending_id = pending.id
        self.db.commit()
        result = update_whatsapp_settings(
            WhatsAppSettingsUpdate(
                gateway_url="https://replacement-gateway.example.com",
                session_name="replacement",
                api_key="replacement-api-key",
                is_enabled=True,
            ),
            db=self.db,
            auth={"user_type": "staff", "role": "superadmin", "name": "Owner"},
        )
        self.assertEqual(result["invalidated_mappings"], 1)
        self.assertEqual(result["superseded_pending_deliveries"], 1)
        self.assertIsNone(self.db.query(CustomerWhatsAppGroup).first().verified_at)
        self.assertEqual(
            self.db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == pending_id).first().status,
            "superseded",
        )
        self.assertNotIn("api_key", result)


if __name__ == "__main__":
    unittest.main()
