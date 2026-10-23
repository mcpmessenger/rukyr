-- Rukyr â€” Supabase schema. Run in the Supabase SQL editor.
-- The app talks to Supabase with the service-role key from server routes only,
-- so RLS is enabled with NO policies (deny-all for anon/authenticated clients).

create table profiles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('agent','human')),
  display_name text not null,
  paypal_email text,
  reputation numeric not null default 5.0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references profiles(id),
  title text not null,
  description text not null default '',
  task_type text not null default 'verification'
    check (task_type in ('verification','bot_gate','phone_call','taste_call','local_presence','spend_approval')),
  price_cents integer not null check (price_cents > 0),
  status text not null default 'pending_funding'
    check (status in ('pending_funding','scheduled','open','claimed','submitted','verified','paid','cancelled','expired')),
  proof_requirements text not null default 'photo',
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  deadline_at timestamptz,
  execute_at timestamptz,
  deadline_minutes integer not null default 240,
  status_reason text,
  created_at timestamptz not null default now()
);
create index tasks_status_idx on tasks(status);
create index tasks_scheduled_idx on tasks(status, execute_at) where status = 'scheduled';

create table proofs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  human_id uuid not null references profiles(id),
  proof_text text not null default '',
  proof_image_url text,
  ai_verdict text check (ai_verdict in ('pass','fail','unsure')),
  ai_confidence numeric,
  ai_reasoning text,
  submitted_at timestamptz not null default now()
);

create table escrows (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references tasks(id) on delete cascade,
  paypal_order_id text,
  paypal_authorization_id text,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending','held','captured','voided')),
  created_at timestamptz not null default now(),
  captured_at timestamptz
);

insert into profiles (kind, display_name, paypal_email) values
  ('agent', 'glazyr-shopper-01', 'agent@example.com'),
  ('human', 'demo-earner', 'human@example.com');

alter table profiles enable row level security;
alter table tasks enable row level security;
alter table proofs enable row level security;
alter table escrows enable row level security;

create table bids (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  bidder_id uuid not null references profiles(id),
  bid_cents integer not null check (bid_cents > 0),
  eta_minutes integer not null default 30,
  pitch text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
create index bids_task_idx on bids(task_id);
alter table bids enable row level security;

create table operator_mandate (
  id integer primary key default 1 check (id = 1),
  vault_id text,
  vault_status text not null default 'unauthorized'
    check (vault_status in ('active','pending_approval','unauthorized','revoked')),
  weekly_cap_cents integer not null default 5000,
  spent_this_week_cents integer not null default 0,
  per_task_cap_cents integer not null default 500,
  operator_email text not null default 'operator@rukyr.ai',
  last_authorized_at timestamptz
);

insert into operator_mandate (
  id, vault_id, vault_status, weekly_cap_cents, spent_this_week_cents, per_task_cap_cents, operator_email, last_authorized_at
) values (
  1, null, 'unauthorized', 5000, 0, 500, 'operator@rukyr.ai', null
) on conflict (id) do nothing;

alter table operator_mandate enable row level security;

-- Proof images: create a public-read Storage bucket named "proofs" (dashboard → Storage),
-- or uncomment:
-- insert into storage.buckets (id, name, public) values ('proofs', 'proofs', true);

