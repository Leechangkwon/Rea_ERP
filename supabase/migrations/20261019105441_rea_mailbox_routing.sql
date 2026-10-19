-- Server-owned delivery reconciliation state; existing mail and mailbox IDs are unchanged.
alter table public.rea_mailboxes add column route_sync jsonb not null default '{}'::jsonb check (jsonb_typeof(route_sync) = 'object');
comment on column public.rea_mailboxes.route_sync is 'Server-managed Cloudflare receipt routing status, no credentials';
