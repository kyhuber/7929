-- 7929 home maintenance schema (PRD §5, plus active_months per build decision)

create type task_kind as enum ('recurring', 'project');
create type task_category as enum (
  'kitchen', 'bathroom', 'bedroom', 'living', 'laundry', 'exterior', 'systems', 'admin'
);
create type task_priority as enum ('next', 'soon', 'someday');
create type task_status as enum ('active', 'done', 'archived');

create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  kind               task_kind not null,
  name               text not null,
  category           task_category not null,
  steps              text[] not null default '{}',
  base_interval_days int,
  seasonal_overrides jsonb,
  -- months (1-12) the task is due-able at all; null = year-round.
  -- e.g. Rain garden water: {6,7,8,9}
  active_months      int[],
  est_minutes        int,
  last_completed_at  timestamptz,
  snooze_until       timestamptz,
  priority           task_priority,
  status             task_status not null default 'active',
  location           text,
  materials          text,
  notes              text,
  created_at         timestamptz not null default now(),

  constraint recurring_has_interval
    check (kind <> 'recurring' or base_interval_days is not null)
);

create table completions (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks (id) on delete cascade,
  completed_at timestamptz not null default now(),
  notes        text
);

create index completions_task_recent_idx on completions (task_id, completed_at desc);
create index tasks_status_idx on tasks (status);

-- Single-owner app: any authenticated session has full access.
alter table tasks enable row level security;
alter table completions enable row level security;

create policy "owner full access" on tasks
  for all to authenticated using (true) with check (true);

create policy "owner full access" on completions
  for all to authenticated using (true) with check (true);
