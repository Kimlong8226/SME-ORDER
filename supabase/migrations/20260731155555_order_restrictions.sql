alter table public.customers
    add column if not exists block_source varchar(20),
    add column if not exists block_reason text,
    add column if not exists blocked_at timestamptz,
    add column if not exists temporary_access_started_at timestamptz,
    add column if not exists temporary_access_until timestamptz,
    add column if not exists temporary_access_reason text,
    add column if not exists restriction_updated_by varchar(100);

alter table public.orders
    add column if not exists updated_at timestamptz,
    add column if not exists version integer not null default 1,
    add column if not exists is_late_override boolean not null default false;

create table if not exists public.order_edit_sessions (
    id varchar(36) primary key,
    customer_id integer not null references public.customers(id) on delete cascade,
    delivery_date date not null,
    started_at timestamptz not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    order_id integer references public.orders(id) on delete set null
);

create index if not exists ix_order_edit_sessions_customer_id
    on public.order_edit_sessions(customer_id);
create index if not exists ix_order_edit_sessions_delivery_date
    on public.order_edit_sessions(delivery_date);
create index if not exists ix_order_edit_sessions_expires_at
    on public.order_edit_sessions(expires_at);

alter table public.order_edit_sessions enable row level security;
revoke all on table public.order_edit_sessions from public, anon, authenticated;

alter table public.audit_logs enable row level security;
revoke all on table public.audit_logs from anon, authenticated;
revoke update, delete on table public.audit_logs from public;
