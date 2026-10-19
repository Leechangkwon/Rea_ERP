-- REA-only mail tables. Existing ERP state, users and roles are not rewritten.
create table public.rea_mailboxes (
 id uuid primary key, address text not null unique check (address=lower(address) and length(address)<=254),
 name text not null check (length(name) between 1 and 80), members text[] not null check (cardinality(members) between 1 and 50),
 provider text not null check (provider in ('gmail','cloudflare')), enabled boolean not null default true,
 revision integer not null default 0 check (revision>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rea_mail_messages (
 id uuid primary key, mailbox_id uuid not null references public.rea_mailboxes(id),
 folder text not null check (folder in ('inbox','sent','draft','trash','spam')), restore_folder text,
 status text not null check (status in ('draft','sending','accepted','delivered','failed','unknown','received')),
 sender text not null, "to" text[] not null default '{}', cc text[] not null default '{}', bcc text[] not null default '{}',
 subject text not null check (length(subject)<=200), body text not null check (length(body)<=64000),
 attachments jsonb not null default '[]', documents jsonb not null default '[]', company_snapshot jsonb not null default '{}', document_ids text[] not null default '{}',
 thread_id uuid not null, in_reply_to text, message_id text, source_id text,
 revision integer not null default 0 check (revision>=0), created_by text not null, read_by text[] not null default '{}',
 provider text not null, request_id uuid, request_hash text, error_code text, search_text text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), finished_at timestamptz,
 unique(mailbox_id,source_id), unique(mailbox_id,request_id)
);
create index rea_mail_messages_folder_time on public.rea_mail_messages(mailbox_id,folder,created_at desc,id desc);
create index rea_mail_messages_reply on public.rea_mail_messages(mailbox_id,message_id);
create table public.rea_mail_ingress_keys (id uuid primary key, token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'), enabled boolean not null default true, created_at timestamptz not null default now());
alter table public.rea_mailboxes enable row level security;
alter table public.rea_mail_messages enable row level security;
alter table public.rea_mail_ingress_keys enable row level security;
revoke all on public.rea_mailboxes,public.rea_mail_messages,public.rea_mail_ingress_keys from public,anon,authenticated;
grant select,insert,update,delete on public.rea_mailboxes,public.rea_mail_messages,public.rea_mail_ingress_keys to service_role;
