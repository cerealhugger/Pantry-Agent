-- Browserbase nutrition verification persists evidence on recipes and logs each run.
alter table recipes
  add column if not exists extraction_confidence numeric,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists web_imports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo',
  input_url text,
  input_query text,
  import_type text not null,
  status text not null default 'pending',
  browserbase_session_id text,
  browserbase_replay_url text,
  browserbase_live_url text,
  extraction_mode text,
  action_log jsonb not null default '[]'::jsonb,
  extracted_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists web_imports_user_created_idx
  on web_imports (user_id, created_at desc);
