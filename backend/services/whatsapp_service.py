from __future__ import annotations

import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from api.audit_utils import write_audit_log
from api.order_rules import MALAYSIA_TZ
from model.models import (
    AUDIT_ACTION_WHATSAPP_SEND,
    CustomerWhatsAppGroup,
    Order,
    WhatsAppDelivery,
    WhatsAppSettings,
)


class WhatsAppConfigurationError(RuntimeError):
    pass


TERMINAL_DELIVERY_STATUSES = {"sent", "server", "device", "read", "failed", "superseded"}


def malaysia_now() -> datetime:
    return datetime.now(MALAYSIA_TZ)


def ensure_do_number(order: Order) -> str:
    """Assign the permanent DO number once. The value never follows later date edits."""
    if order.do_number:
        return order.do_number
    if order.id is None:
        raise ValueError("Order must be flushed before assigning a DO number")
    date_part = order.delivery_date.strftime("%Y%m%d") if order.delivery_date else "00000000"
    order.do_number = f"DO-{date_part}-{order.id:04d}"
    return order.do_number


def display_do_number(order: Order) -> str:
    if order.do_number:
        return order.do_number
    date_part = order.delivery_date.strftime("%Y%m%d") if order.delivery_date else "00000000"
    return f"DO-{date_part}-{order.id:04d}"


def _fernet() -> Fernet:
    secret = os.getenv("WHATSAPP_CONFIG_ENCRYPTION_KEY")
    if not secret:
        raise WhatsAppConfigurationError("WHATSAPP_CONFIG_ENCRYPTION_KEY must be configured")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_api_key(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_api_key(value: str | None) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise WhatsAppConfigurationError("WhatsApp API key cannot be decrypted") from exc


def validate_gateway_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise WhatsAppConfigurationError("Gateway URL must be a valid HTTP or HTTPS URL")
    if parsed.username or parsed.password or parsed.fragment or parsed.query:
        raise WhatsAppConfigurationError("Gateway URL cannot include credentials, a query, or a fragment")
    return normalized


def get_settings(db: Session) -> WhatsAppSettings | None:
    return db.query(WhatsAppSettings).filter(WhatsAppSettings.id == 1).first()


def get_active_mapping(db: Session, customer_id: int) -> CustomerWhatsAppGroup | None:
    return db.query(CustomerWhatsAppGroup).filter(
        CustomerWhatsAppGroup.customer_id == customer_id,
        CustomerWhatsAppGroup.is_enabled == True,
    ).first()


def require_ready_mapping(db: Session, customer_id: int) -> CustomerWhatsAppGroup | None:
    settings = get_settings(db)
    if not settings or not settings.is_enabled:
        return None
    if not settings.gateway_url or not settings.api_key_encrypted:
        raise WhatsAppConfigurationError("WhatsApp 已启用，但 Gateway URL 或 API Key 尚未设置")
    mapping = get_active_mapping(db, customer_id)
    if not mapping:
        raise WhatsAppConfigurationError("该顾客尚未绑定可用的 WhatsApp 群组")
    if not mapping.verified_at:
        raise WhatsAppConfigurationError("该顾客的 WhatsApp 群组尚未通过测试发送验证")
    return mapping


def _gateway_request(
    settings: WhatsAppSettings,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    timeout_seconds: int = 20,
) -> Any:
    gateway_url = validate_gateway_url(settings.gateway_url)
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    api_key = decrypt_api_key(settings.api_key_encrypted)
    if api_key:
        headers["X-Api-Key"] = api_key
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = Request(f"{gateway_url}{path}", data=body, method=method, headers=headers)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Gateway HTTP {exc.code}: {detail or exc.reason}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"Gateway connection failed: {exc}") from exc


def list_gateway_groups(db: Session) -> list[dict[str, str]]:
    settings = get_settings(db)
    if not settings or not settings.gateway_url or not settings.api_key_encrypted:
        raise WhatsAppConfigurationError("请先保存 Gateway URL 与 API Key")
    session = quote(settings.session_name or "default", safe="")
    query = urlencode({"limit": 1000, "exclude": "participants"})
    response = _gateway_request(settings, "GET", f"/api/{session}/groups?{query}")
    rows = response.get("data", response) if isinstance(response, dict) else response
    if not isinstance(rows, list):
        raise RuntimeError("Gateway returned an invalid groups response")
    groups: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        group_id = str(row.get("id") or row.get("chatId") or "").strip()
        group_name = str(row.get("name") or row.get("subject") or group_id).strip()
        if group_id.endswith("@g.us"):
            groups.append({"group_id": group_id, "group_name": group_name})
    return sorted(groups, key=lambda item: item["group_name"].casefold())


def get_gateway_qr(db: Session) -> dict[str, str]:
    settings = get_settings(db)
    if not settings or not settings.gateway_url or not settings.api_key_encrypted:
        raise WhatsAppConfigurationError("请先保存 Gateway URL 与 API Key")
    session = quote(settings.session_name or "default", safe="")
    response = _gateway_request(settings, "GET", f"/api/{session}/auth/qr")
    if not isinstance(response, dict):
        raise RuntimeError("Gateway returned an invalid QR response")
    mimetype = str(response.get("mimetype") or "image/png").lower()
    data = str(response.get("data") or "").strip()
    if mimetype not in {"image/png", "image/jpeg"} or not data:
        raise RuntimeError("Gateway did not return a QR image")
    try:
        base64.b64decode(data, validate=True)
    except ValueError as exc:
        raise RuntimeError("Gateway returned invalid QR image data") from exc
    return {"mimetype": mimetype, "data": data, "session_name": settings.session_name or "default"}


def send_test_message(db: Session, mapping: CustomerWhatsAppGroup, operator_name: str) -> dict[str, Any]:
    settings = get_settings(db)
    if not settings or not settings.gateway_url or not settings.api_key_encrypted:
        raise WhatsAppConfigurationError("请先保存 Gateway URL 与 API Key")
    response = _gateway_request(settings, "POST", "/api/sendText", {
        "session": settings.session_name or "default",
        "chatId": mapping.group_id,
        "text": f"✅ WhatsApp 群组绑定测试成功\n客户：{mapping.customer.company_name}\n操作人员：{operator_name}\n时间：{malaysia_now().strftime('%d/%m/%Y %H:%M')}",
    })
    mapping.verified_at = datetime.now(timezone.utc)
    mapping.updated_at = datetime.now(timezone.utc)
    return response if isinstance(response, dict) else {"response": response}


def enqueue_order_message(
    db: Session,
    order: Order,
    event_type: str,
    requested_by: str,
    request_reason: str | None = None,
    manual: bool = False,
    requested_role: str = "staff",
) -> WhatsAppDelivery | None:
    mapping = require_ready_mapping(db, order.customer_id)
    if mapping is None:
        return None

    ensure_do_number(order)
    dedupe_key = (
        f"manual:{order.id}:{order.version}:{uuid4()}"
        if manual
        else f"auto:{order.id}:{order.version}:{event_type}"
    )
    existing = db.query(WhatsAppDelivery).filter(WhatsAppDelivery.dedupe_key == dedupe_key).first()
    if existing:
        return existing

    now = datetime.now(timezone.utc)
    superseded_query = db.query(WhatsAppDelivery).filter(
        WhatsAppDelivery.order_id == order.id,
        WhatsAppDelivery.status.in_(["pending", "failed"]),
    )
    if manual:
        superseded_query = superseded_query.filter(
            WhatsAppDelivery.order_version <= (order.version or 1)
        )
    else:
        superseded_query = superseded_query.filter(
            WhatsAppDelivery.order_version < (order.version or 1)
        )
    superseded_query.update({
        WhatsAppDelivery.status: "superseded",
        WhatsAppDelivery.updated_at: now,
    }, synchronize_session=False)

    delivery = WhatsAppDelivery(
        order_id=order.id,
        order_version=order.version or 1,
        event_type="manual" if manual else event_type,
        dedupe_key=dedupe_key,
        group_id=mapping.group_id,
        group_name=mapping.group_name,
        show_prices=bool(mapping.show_prices),
        status="pending",
        attempt_count=0,
        requested_by=requested_by,
        request_reason=request_reason,
        created_at=now,
        updated_at=now,
    )
    db.add(delivery)
    db.flush()
    # Freeze the exact approved/updated/cancelled DO text in the outbox. A later
    # status-only change must not silently rewrite a message that is being retried.
    db.expire(order, ["details"])
    delivery.message_text = format_delivery_message(delivery, order)
    write_audit_log(
        db=db,
        action_type=AUDIT_ACTION_WHATSAPP_SEND,
        description=f"建立 {display_do_number(order)} WhatsApp {'重新发送' if manual else '自动发送'}任务",
        operator_name=requested_by,
        operator_role=requested_role,
        target_id=order.id,
        target_label=display_do_number(order),
        extra_data={
            "delivery_id": delivery.id,
            "event_type": delivery.event_type,
            "order_version": delivery.order_version,
            "group_name": delivery.group_name,
            "reason": request_reason,
        },
    )
    return delivery


def _event_header(event_type: str) -> str:
    return {
        "confirmed": "✅ DO 已确认",
        "updated": "🔄 DO 已修改",
        "cancelled": "❌ DO 已取消",
        "manual": "♻️ DO 重新发送",
    }.get(event_type, "📄 DO 通知")


def format_delivery_message(delivery: WhatsAppDelivery, order: Order) -> str:
    status_label = {
        "submitted": "待批准",
        "confirmed": "已确认",
        "in_production": "生产中",
        "delivered": "已送达",
        "billed": "已核账",
        "paid": "已付款",
        "cancelled": "已取消",
    }.get(order.status, order.status)
    details = sorted(
        order.details,
        key=lambda detail: (
            detail.meal_section.sort_order if detail.meal_section else 999,
            detail.id or 0,
        ),
    )
    grouped: dict[str, list[Any]] = {}
    total_portions = 0
    total_amount = 0.0
    for detail in details:
        meal_name = detail.meal_section.name if detail.meal_section else "其他餐次"
        grouped.setdefault(meal_name, []).append(detail)
        quantity = detail.quantity or 0
        total_portions += quantity
        total_amount += quantity * (detail.final_unit_price or 0.0)

    lines = [
        _event_header(delivery.event_type),
        "",
        f"DO编号：{display_do_number(order)}",
        f"版本：V{delivery.order_version}",
        f"状态：{status_label}",
        f"客户：{order.customer.company_name}",
        f"送餐地点：{order.site.site_name if order.site else '-'}",
        f"送餐日期：{order.delivery_date.strftime('%d/%m/%Y')}",
    ]
    if delivery.request_reason and delivery.event_type in {"updated", "manual", "cancelled"}:
        lines.append(f"处理原因：{delivery.request_reason}")

    for meal_name, meal_details in grouped.items():
        lines.extend(["", f"【{meal_name}】"])
        for detail in meal_details:
            package_name = (
                detail.customer_package.template.name
                if detail.customer_package and detail.customer_package.template
                else detail.customer_addon.template.name
                if detail.customer_addon and detail.customer_addon.template
                else "未命名餐品"
            )
            item_line = f"{package_name} × {detail.quantity or 0}份"
            if delivery.show_prices:
                item_line += f"（RM {(detail.final_unit_price or 0.0):.2f}/份）"
            lines.append(item_line)
            if detail.remark:
                lines.append(f"备注：{detail.remark}")

    lines.extend(["", f"总数量：{total_portions}份"])
    if delivery.show_prices:
        lines.append(f"总金额：RM {total_amount:.2f}")
    if order.remark:
        lines.append(f"DO备注：{order.remark}")
    lines.extend([
        "",
        f"处理人员：{delivery.requested_by}",
        f"发送时间：{malaysia_now().strftime('%d/%m/%Y %H:%M')}",
        f"⚠️ 请以 {display_do_number(order)} V{delivery.order_version} 为准",
    ])
    return "\n".join(lines)


def _extract_message_id(response: Any) -> str | None:
    if not isinstance(response, dict):
        return None
    direct = response.get("id") or response.get("messageId")
    if isinstance(direct, str):
        return direct
    if isinstance(direct, dict):
        return str(direct.get("_serialized") or direct.get("id") or "") or None
    data = response.get("_data") or response.get("data")
    if isinstance(data, dict):
        return _extract_message_id(data)
    key = response.get("key")
    if isinstance(key, dict):
        return _extract_message_id(key)
    return None


def _claim_delivery(db: Session, delivery_id: int) -> bool:
    """Atomically claim the one immediate send attempt for a delivery record."""
    now = datetime.now(timezone.utc)
    updated = db.query(WhatsAppDelivery).filter(
        WhatsAppDelivery.id == delivery_id,
        WhatsAppDelivery.status == "pending",
    ).update({
        WhatsAppDelivery.status: "sending",
        WhatsAppDelivery.attempt_count: WhatsAppDelivery.attempt_count + 1,
        WhatsAppDelivery.last_error: None,
        WhatsAppDelivery.updated_at: now,
    }, synchronize_session=False)
    db.commit()
    return updated == 1


def process_delivery(db: Session, delivery_id: int) -> WhatsAppDelivery:
    delivery = db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == delivery_id).first()
    if not delivery:
        raise LookupError("WhatsApp delivery task not found")
    if delivery.status in TERMINAL_DELIVERY_STATUSES:
        return delivery

    order = db.query(Order).filter(Order.id == delivery.order_id).first()
    if not order:
        delivery.status = "failed"
        delivery.last_error = "DO no longer exists"
        db.commit()
        return delivery
    mapping = get_active_mapping(db, order.customer_id)
    if (
        not mapping
        or not mapping.verified_at
        or mapping.group_id != delivery.group_id
        or bool(mapping.show_prices) != bool(delivery.show_prices)
    ):
        delivery.status = "superseded"
        delivery.last_error = "Customer WhatsApp mapping changed, was disabled, or is no longer verified"
        delivery.updated_at = datetime.now(timezone.utc)
        db.commit()
        return delivery

    settings = get_settings(db)
    if not settings or not settings.is_enabled:
        delivery.status = "failed"
        delivery.last_error = "WhatsApp automation is disabled"
        delivery.updated_at = datetime.now(timezone.utc)
        db.commit()
        return delivery

    if not _claim_delivery(db, delivery_id):
        return db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == delivery_id).first()

    try:
        delivery = db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == delivery_id).first()
        if not delivery.message_text:
            delivery.message_text = format_delivery_message(delivery, order)
            db.commit()
        response = _gateway_request(settings, "POST", "/api/sendText", {
            "session": settings.session_name or "default",
            "chatId": delivery.group_id,
            "text": delivery.message_text,
        })
        delivery = db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == delivery_id).first()
        delivery.status = "sent"
        delivery.gateway_message_id = _extract_message_id(response)
        delivery.sent_at = datetime.now(timezone.utc)
        delivery.updated_at = datetime.now(timezone.utc)
        db.commit()
        return delivery
    except Exception as exc:
        delivery = db.query(WhatsAppDelivery).filter(WhatsAppDelivery.id == delivery_id).first()
        if delivery.status != "sending":
            return delivery
        delivery.status = "failed"
        delivery.last_error = str(exc)[:1000]
        delivery.updated_at = datetime.now(timezone.utc)
        db.commit()
        return delivery


def apply_ack_event(db: Session, payload: dict[str, Any]) -> WhatsAppDelivery | None:
    message_id = str(payload.get("id") or "")
    if not message_id:
        return None
    delivery = db.query(WhatsAppDelivery).filter(WhatsAppDelivery.gateway_message_id == message_id).first()
    participant = str(payload.get("participant") or "")
    if not delivery and participant and message_id.endswith(f"_{participant}"):
        base_message_id = message_id[:-(len(participant) + 1)]
        delivery = db.query(WhatsAppDelivery).filter(
            WhatsAppDelivery.gateway_message_id == base_message_id
        ).first()
    if not delivery:
        return None
    ack_name = str(payload.get("ackName") or "").upper()
    if not ack_name:
        ack_name = {
            -1: "ERROR",
            0: "PENDING",
            1: "SERVER",
            2: "DEVICE",
            3: "READ",
            4: "PLAYED",
        }.get(payload.get("ack"), "")
    now = datetime.now(timezone.utc)
    if ack_name == "ERROR":
        if delivery.status not in {"server", "device", "read"}:
            delivery.status = "failed"
            delivery.last_error = "WhatsApp acknowledgment returned ERROR"
    elif ack_name == "SERVER" and delivery.status not in {"device", "read"}:
        delivery.status = "server"
    elif ack_name == "DEVICE" and delivery.status != "read":
        delivery.status = "device"
        delivery.delivered_at = now
    elif ack_name in {"READ", "PLAYED"}:
        delivery.status = "read"
        delivery.delivered_at = delivery.delivered_at or now
        delivery.read_at = now
    if ack_name in {"SERVER", "DEVICE", "READ", "PLAYED"}:
        delivery.sent_at = delivery.sent_at or now
        delivery.last_error = None
    delivery.updated_at = now
    db.commit()
    return delivery


def serialize_delivery(
    delivery: WhatsAppDelivery | None,
    include_message_text: bool = False,
) -> dict[str, Any] | None:
    if not delivery:
        return None
    payload = {
        "id": delivery.id,
        "order_id": delivery.order_id,
        "order_version": delivery.order_version,
        "event_type": delivery.event_type,
        "group_name": delivery.group_name,
        "status": delivery.status,
        "attempt_count": delivery.attempt_count,
        "gateway_message_id": delivery.gateway_message_id,
        "last_error": delivery.last_error,
        "requested_by": delivery.requested_by,
        "request_reason": delivery.request_reason,
        "created_at": delivery.created_at,
        "sent_at": delivery.sent_at,
        "delivered_at": delivery.delivered_at,
        "read_at": delivery.read_at,
    }
    if include_message_text:
        payload["message_text"] = delivery.message_text
    return payload
