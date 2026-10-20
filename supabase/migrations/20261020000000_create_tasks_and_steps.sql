-- Apply once to a Supabase project using the SQL Editor.
-- All changes succeed together, or none are saved.
begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  starting_time timestamptz,
  starting_place text,
  created_at timestamptz not null default now()
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  description text not null check (length(btrim(description)) > 0),
  is_complete boolean not null default false,
  position integer not null check (position >= 0)
);

-- Support ownership lookups and fetching a task's steps in order.
-- Break ties in position with id when querying (ORDER BY position, id).
create index tasks_user_id_idx on public.tasks (user_id);
create index steps_task_id_position_idx on public.steps (task_id, position, id);

alter table public.tasks enable row level security;
alter table public.steps enable row level security;

-- Remove default API permissions, then allow only normal CRUD operations
-- for signed-in users. RLS further limits which rows they can access.
revoke all on table public.tasks, public.steps from public, anon, authenticated;
grant select, insert, update, delete on table public.tasks, public.steps to authenticated;

create policy tasks_select_own on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Check both the existing row and the proposed updated row. This prevents
-- changing the owner to another account as well as editing others' tasks.
create policy tasks_update_own on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Steps inherit ownership from their parent task; there is no separate
-- step owner field that could disagree with the task's owner.
create policy steps_select_own on public.steps
  for select to authenticated
  using (exists (
    select 1 from public.tasks
    where tasks.id = steps.task_id and tasks.user_id = (select auth.uid())
  ));

create policy steps_insert_own on public.steps
  for insert to authenticated
  with check (exists (
    select 1 from public.tasks
    where tasks.id = steps.task_id and tasks.user_id = (select auth.uid())
  ));

-- Validate the new parent too, so a step cannot be moved to another user's task.
create policy steps_update_own on public.steps
  for update to authenticated
  using (exists (
    select 1 from public.tasks
    where tasks.id = steps.task_id and tasks.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.tasks
    where tasks.id = steps.task_id and tasks.user_id = (select auth.uid())
  ));

create policy steps_delete_own on public.steps
  for delete to authenticated
  using (exists (
    select 1 from public.tasks
    where tasks.id = steps.task_id and tasks.user_id = (select auth.uid())
  ));

commit;
