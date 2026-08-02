# Shared KIM LONG WhatsApp Delivery Setup

The application sends approved, updated, cancelled, and manually sent DOs to the single WhatsApp group assigned to each customer.

## Safety boundaries

- Only `superadmin` can access `/admin/whatsapp/*` settings and mapping endpoints.
- Staff can approve a DO or use the WhatsApp button in **Order Status** only for the already approved customer group.
- Gateway credentials are server-managed environment variables and are never returned by the API.
- A WhatsApp group can be assigned to only one customer.
- Enabling automation blocks confirmation or editing of an approved DO when its customer has no active, test-verified group mapping.
- Changing/disabling a group or changing its price visibility supersedes that customer's unsent tasks so an old group or old price policy cannot be used; test the new mapping and manually resend the affected DOs.
- This application must never log out, restart, or clear the shared KIM LONG Gateway session. Doing so would disconnect both systems.
- Approval, DO changes, and cancellation each make one immediate automatic send attempt. There is no scheduled or background retry.
- A failed attempt stays visible on the DO. Staff must deliberately use its WhatsApp button in **Order Status** to send again.
- Every attempt is retained in `whatsapp_deliveries` and recorded in Audit Log.

## Required deployment steps

1. Apply `supabase/migrations/20260802090000_whatsapp_do_delivery.sql` to the target database after taking the normal production backup.
2. Configure these environment variables only on the Central Kitchen backend:
   - `WHATSAPP_GATEWAY_URL=https://<kim-long-whatsapp-gateway-domain>`
   - `WHATSAPP_GATEWAY_SHARED_SECRET=<same secret already used by KIM LONG>`
3. Do not put either value in Vite/frontend environment variables. Do not change the existing KIM LONG Gateway service or its persisted `default` session.
4. Sign in as `superadmin` and open **WhatsApp Settings**. The page reads the shared connection status and displays a QR only when the existing Gateway needs login.
5. Load the live groups, bind each customer, and complete a successful test message for every group before enabling automatic sends.
6. No Vercel Cron is required. The backend waits for the immediate Gateway response and shows failures in **Order Status**.

The KIM LONG Gateway accepts the send request but does not currently provide WAHA delivery/read acknowledgment webhooks. A successful request is therefore recorded as `sent`; later `server`, `device`, and `read` states are not expected from this shared adapter.

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
