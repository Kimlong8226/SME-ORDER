# WhatsApp DO Delivery Setup

The application sends approved, updated, cancelled, and manually sent DOs to the single WhatsApp group assigned to each customer.

## Safety boundaries

- Only `superadmin` can access `/admin/whatsapp/*` settings and mapping endpoints.
- Staff can approve a DO or use the WhatsApp button in **Order Status** only for the already approved customer group.
- API keys are encrypted at rest and are never returned by the API.
- A WhatsApp group can be assigned to only one customer.
- Enabling automation blocks confirmation or editing of an approved DO when its customer has no active, test-verified group mapping.
- Changing/disabling a group or changing its price visibility supersedes that customer's unsent tasks so an old group or old price policy cannot be used; test the new mapping and manually resend the affected DOs.
- Changing the Gateway URL, session name, or API key invalidates all tested mappings and supersedes unsent tasks; reload the live groups, test every mapping again, then resend affected DOs.
- Approval, DO changes, and cancellation each make one immediate automatic send attempt. There is no scheduled or background retry.
- A failed attempt stays visible on the DO. Staff must deliberately use its WhatsApp button in **Order Status** to send again.
- Every attempt is retained in `whatsapp_deliveries` and recorded in Audit Log.

## Required deployment steps

1. Apply `supabase/migrations/20260802090000_whatsapp_do_delivery.sql` to the target database after taking the normal production backup.
2. Configure these server-side environment variables:
   - `WHATSAPP_CONFIG_ENCRYPTION_KEY`
   - `WHATSAPP_WEBHOOK_SECRET`

   Use separate random values of at least 32 characters. Keep `WHATSAPP_CONFIG_ENCRYPTION_KEY` stable; if it is rotated, re-enter the WAHA API key through the superadmin screen.
3. Deploy a WAHA Gateway with a persistent session volume and an API key. Restrict WAHA Dashboard access to the highest-permission operator as well. Start the session there and scan its QR from the dedicated WhatsApp Business number under **Linked devices**. The QR is intentionally not shown to normal staff in this application.
4. Configure WAHA to send `message.ack` and `message.ack.group` webhooks to:

   `POST https://<backend-domain>/webhooks/whatsapp`

   For a global WAHA webhook, configure at least:

   - `WHATSAPP_HOOK_EVENTS=message.ack,message.ack.group`
   - `WHATSAPP_HOOK_CUSTOM_HEADERS=X-Webhook-Secret:<WHATSAPP_WEBHOOK_SECRET value>`

5. No Vercel Cron is required. The backend waits for the one immediate Gateway result and shows any failure in **Order Status**, so this workflow does not require a Vercel Pro Cron schedule.
6. Sign in as `superadmin`, open **WhatsApp Settings**, save the Gateway details, load the live groups, bind each customer, and complete a successful test message for every group before enabling automatic sends.

For an existing local SQLite database, run `migrate_local_schema_20260801.py` instead of the Supabase migration.

## Delivery states

- `pending`: the immediate attempt did not finish; use the DO's WhatsApp button for a deliberate manual send
- `sending`: request is in progress
- `sent`: Gateway accepted the message
- `server`: WhatsApp server acknowledged it
- `device`: delivered to a device
- `read`: read acknowledgment received
- `failed`: the attempt failed; the error is retained and there is no automatic retry
- `superseded`: a newer DO version replaced this unsent version
