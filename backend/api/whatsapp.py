from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.audit_utils import write_audit_log
from api.auth import require_staff, require_superadmin
from database import get_db
from model.models import (
    AUDIT_ACTION_WHATSAPP_GROUP_UPDATE,
    AUDIT_ACTION_WHATSAPP_SETTINGS_UPDATE,
    Customer,
    CustomerWhatsAppGroup,
    Order,
    WhatsAppDelivery,
    WhatsAppSettings,
)
from services.whatsapp_service import (
    WhatsAppConfigurationError,
    apply_ack_event,
    enqueue_order_message,
    get_active_mapping,
    get_gateway_qr,
    get_gateway_status,
    get_gateway_configuration,
    get_settings,
    list_gateway_groups,
    process_delivery,
    send_test_message,
    serialize_delivery,
)


settings_router = APIRouter(
    prefix="/admin/whatsapp",
    tags=["WhatsApp Settings"],
    dependencies=[Depends(require_superadmin)],
)
operations_router = APIRouter(
    prefix="/admin",
    tags=["WhatsApp DO Delivery"],
    dependencies=[Depends(require_staff)],
)
system_router = APIRouter(tags=["WhatsApp System"])


class WhatsAppSettingsUpdate(BaseModel):
    is_enabled: bool = False


class CustomerGroupUpdate(BaseModel):
    group_id: str = Field(min_length=5, max_length=200)
    group_name: str = Field(min_length=1, max_length=200)
    is_enabled: bool = True
    show_prices: bool = False
    reason: str = Field(min_length=3, max_length=500)


class ResendRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    expected_order_version: Optional[int] = None


def _operator(auth: dict) -> tuple[str, str]:
    return auth.get("name") or auth.get("sub") or "后台管理员", auth.get("role") or "staff"


def _settings_payload(settings: WhatsAppSettings | None, db: Session) -> dict:
    pending_count = db.query(func.count(WhatsAppDelivery.id)).filter(
        WhatsAppDelivery.status.in_(["pending", "sending"])
    ).scalar() or 0
    failed_count = db.query(func.count(WhatsAppDelivery.id)).filter(
        WhatsAppDelivery.status == "failed"
    ).scalar() or 0
    try:
        get_gateway_configuration()
        gateway_configured = True
    except WhatsAppConfigurationError:
        gateway_configured = False
    return {
        "gateway_configured": gateway_configured,
        "is_enabled": bool(settings and settings.is_enabled),
        "updated_by": settings.updated_by if settings else None,
        "updated_at": settings.updated_at if settings else None,
        "pending_count": pending_count,
        "failed_count": failed_count,
    }


@settings_router.get("/settings")
def read_whatsapp_settings(db: Session = Depends(get_db)):
    return _settings_payload(get_settings(db), db)


@settings_router.put("/settings")
def update_whatsapp_settings(
    req: WhatsAppSettingsUpdate,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_superadmin),
):
    operator_name, operator_role = _operator(auth)
    settings = get_settings(db)
    before = _settings_payload(settings, db)
    if req.is_enabled:
        try:
            get_gateway_configuration()
        except WhatsAppConfigurationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not settings:
        settings = WhatsAppSettings(id=1)
        db.add(settings)
    settings.is_enabled = req.is_enabled
    settings.updated_by = operator_name
    settings.updated_at = datetime.now(timezone.utc)

    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_WHATSAPP_SETTINGS_UPDATE,
        description="更新 WhatsApp 自动发送设置",
        operator_name=operator_name,
        operator_role=operator_role,
        target_label="WhatsApp Settings",
        extra_data={
            "reason": "Superadmin automation update",
            "before": {
                key: value.isoformat() if isinstance(value, datetime) else value
                for key, value in before.items()
                if key not in {"pending_count", "failed_count"}
            },
            "after": {"is_enabled": settings.is_enabled},
        },
    )
    db.commit()
    db.refresh(settings)
    return _settings_payload(settings, db)


@settings_router.get("/groups")
def read_gateway_groups(db: Session = Depends(get_db)):
    try:
        return list_gateway_groups(db)
    except (WhatsAppConfigurationError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@settings_router.get("/qr")
def read_gateway_qr(db: Session = Depends(get_db)):
    try:
        return get_gateway_qr(db)
    except (WhatsAppConfigurationError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@settings_router.get("/status")
def read_gateway_status(db: Session = Depends(get_db)):
    try:
        return get_gateway_status(db)
    except (WhatsAppConfigurationError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@settings_router.get("/customer-mappings")
def read_customer_mappings(db: Session = Depends(get_db)):
    customers = db.query(Customer).order_by(Customer.company_name.asc()).all()
    return [
        {
            "customer_id": customer.id,
            "company_name": customer.company_name,
            "group_id": customer.whatsapp_group.group_id if customer.whatsapp_group else None,
            "group_name": customer.whatsapp_group.group_name if customer.whatsapp_group else None,
            "is_enabled": bool(customer.whatsapp_group and customer.whatsapp_group.is_enabled),
            "show_prices": bool(customer.whatsapp_group and customer.whatsapp_group.show_prices),
            "verified_at": customer.whatsapp_group.verified_at if customer.whatsapp_group else None,
            "updated_by": customer.whatsapp_group.updated_by if customer.whatsapp_group else None,
        }
        for customer in customers
    ]


@settings_router.put("/customer-mappings/{customer_id}")
def update_customer_mapping(
    customer_id: int,
    req: CustomerGroupUpdate,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_superadmin),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="顾客不存在")
    group_id = req.group_id.strip()
    if not group_id.endswith("@g.us"):
        raise HTTPException(status_code=400, detail="目标必须是有效的 WhatsApp 群组 ID")
    try:
        live_groups = list_gateway_groups(db)
    except (WhatsAppConfigurationError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=f"无法验证目标群组：{exc}") from exc
    live_group = next((row for row in live_groups if row["group_id"] == group_id), None)
    if not live_group:
        raise HTTPException(status_code=409, detail="该群组不在当前 WhatsApp 账号的群组清单中")
    duplicate_mapping = db.query(CustomerWhatsAppGroup).filter(
        CustomerWhatsAppGroup.group_id == group_id,
        CustomerWhatsAppGroup.customer_id != customer_id,
    ).first()
    if duplicate_mapping:
        raise HTTPException(status_code=409, detail="该 WhatsApp 群组已绑定给其他顾客")

    operator_name, operator_role = _operator(auth)
    mapping = db.query(CustomerWhatsAppGroup).filter(
        CustomerWhatsAppGroup.customer_id == customer_id
    ).first()
    before = ({
        "group_id": mapping.group_id,
        "group_name": mapping.group_name,
        "is_enabled": mapping.is_enabled,
        "show_prices": mapping.show_prices,
    } if mapping else None)
    group_changed = not mapping or mapping.group_id != group_id
    if not mapping:
        mapping = CustomerWhatsAppGroup(customer_id=customer_id)
        db.add(mapping)
    mapping.group_id = group_id
    mapping.group_name = live_group["group_name"]
    mapping.is_enabled = req.is_enabled
    mapping.show_prices = req.show_prices
    if group_changed:
        mapping.verified_at = None
    mapping.updated_by = operator_name
    mapping.updated_at = datetime.now(timezone.utc)

    routing_changed = (
        group_changed
        or not req.is_enabled
        or bool(before and before["show_prices"]) != bool(req.show_prices)
    )
    superseded_count = 0
    if routing_changed:
        pending_rows = db.query(WhatsAppDelivery).join(
            Order, WhatsAppDelivery.order_id == Order.id
        ).filter(
            Order.customer_id == customer_id,
            WhatsAppDelivery.status.in_(["pending", "failed"]),
        ).all()
        now = datetime.now(timezone.utc)
        for delivery in pending_rows:
            delivery.status = "superseded"
            delivery.last_error = "Customer WhatsApp routing was changed by superadmin"
            delivery.updated_at = now
        superseded_count = len(pending_rows)

    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_WHATSAPP_GROUP_UPDATE,
        description=f"更新客户 {customer.company_name} 的 WhatsApp 群组绑定",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=customer.id,
        target_label=customer.company_name,
        extra_data={
            "reason": req.reason.strip(),
            "before": before,
            "after": {
                "group_id": mapping.group_id,
                "group_name": mapping.group_name,
                "is_enabled": mapping.is_enabled,
                "show_prices": mapping.show_prices,
            },
            "superseded_pending_deliveries": superseded_count,
        },
    )
    db.commit()
    return {
        "message": "WhatsApp 群组绑定已保存；首次使用或更换群组后必须完成测试发送",
        "group_name": mapping.group_name,
        "verified": bool(mapping.verified_at),
        "superseded_pending_deliveries": superseded_count,
    }


@settings_router.post("/customer-mappings/{customer_id}/test")
def test_customer_mapping(
    customer_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_superadmin),
):
    mapping = get_active_mapping(db, customer_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="该顾客没有启用的 WhatsApp 群组绑定")
    operator_name, operator_role = _operator(auth)
    try:
        send_test_message(db, mapping, operator_name)
    except (WhatsAppConfigurationError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_WHATSAPP_GROUP_UPDATE,
        description=f"测试客户 {mapping.customer.company_name} 的 WhatsApp 群组绑定",
        operator_name=operator_name,
        operator_role=operator_role,
        target_id=customer_id,
        target_label=mapping.customer.company_name,
        extra_data={"group_name": mapping.group_name, "result": "sent"},
    )
    db.commit()
    return {"message": "测试信息已发送", "verified_at": mapping.verified_at}


@operations_router.get("/orders/{order_id}/whatsapp-deliveries")
def read_order_deliveries(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="DO 不存在")
    settings = get_settings(db)
    mapping = get_active_mapping(db, order.customer_id)
    rows = db.query(WhatsAppDelivery).filter(
        WhatsAppDelivery.order_id == order_id
    ).order_by(WhatsAppDelivery.created_at.desc(), WhatsAppDelivery.id.desc()).limit(20).all()
    return {
        "automation_enabled": bool(settings and settings.is_enabled),
        "group_configured": bool(mapping),
        "group_name": mapping.group_name if mapping else None,
        "deliveries": [serialize_delivery(row, include_message_text=True) for row in rows],
    }


@operations_router.post("/orders/{order_id}/whatsapp-resend")
def resend_order_whatsapp(
    order_id: int,
    req: ResendRequest,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    reason = req.reason.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="重新发送原因至少需要 3 个字符")
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="DO 不存在")
    if order.status == "submitted":
        raise HTTPException(status_code=409, detail="DO 尚未批准，不能发送到客户群")
    if req.expected_order_version is not None and order.version != req.expected_order_version:
        raise HTTPException(status_code=409, detail="DO 已被修改，请刷新后再重新发送")
    operator_name, operator_role = _operator(auth)
    try:
        delivery = enqueue_order_message(
            db,
            order,
            event_type="manual",
            requested_by=operator_name,
            request_reason=reason,
            manual=True,
            requested_role=operator_role,
        )
    except WhatsAppConfigurationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not delivery:
        raise HTTPException(status_code=409, detail="WhatsApp 自动发送尚未启用")
    delivery_id = delivery.id
    db.commit()
    result = process_delivery(db, delivery_id)
    return {"message": "WhatsApp 重新发送任务已处理", "delivery": serialize_delivery(result)}


@system_router.post("/webhooks/whatsapp")
async def whatsapp_webhook(
    request: Request,
    x_webhook_secret: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    expected = os.getenv("WHATSAPP_WEBHOOK_SECRET", "")
    if not expected or not x_webhook_secret or not hmac.compare_digest(expected, x_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")
    body = await request.json()
    settings = get_settings(db)
    if settings and body.get("session") not in {None, settings.session_name or "default"}:
        return {"accepted": True, "matched": False}
    if body.get("event") in {"message.ack", "message.ack.group"}:
        delivery = apply_ack_event(db, body.get("payload") or {})
        return {"accepted": True, "matched": bool(delivery)}
    return {"accepted": True, "matched": False}
