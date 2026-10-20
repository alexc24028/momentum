-- Apply after 20261020000000_create_tasks_and_steps.sql. Preserves all rows and RLS.
begin;

alter table public.tasks
  add column description text,
  add column due_at timestamptz,
  add column sort_position integer not null default 0 check (sort_position >= 0);

-- Preserve the previous newest-first order, independently for each owner.
with ranked as (
  select id, (row_number() over (partition by user_id order by created_at desc, id) - 1)::integer as position
  from public.tasks
)
update public.tasks set sort_position = ranked.position from ranked where tasks.id = ranked.id;

create index tasks_user_sort_idx on public.tasks (user_id, sort_position, created_at desc, id);

-- Save the complete order atomically: an error cannot leave a half-saved order.
-- SECURITY INVOKER keeps the existing authenticated role and RLS protections.
create function public.reorder_tasks(task_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to reorder tasks';
  end if;
  if task_ids is null
    or cardinality(task_ids) <> (select count(distinct id) from unnest(task_ids) as ids(id))
    or cardinality(task_ids) <> (select count(*) from public.tasks where user_id = auth.uid())
    or exists (
      select 1 from unnest(task_ids) as ids(id)
      where not exists (select 1 from public.tasks where tasks.id = ids.id and user_id = auth.uid())
    ) then
    raise exception 'Task list changed. Reload tasks and try again';
  end if;

  update public.tasks as task
  set sort_position = (ordered.position - 1)::integer
  from unnest(task_ids) with ordinality as ordered(id, position)
  where task.id = ordered.id and task.user_id = auth.uid();
end;
$$;

revoke all on function public.reorder_tasks(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_tasks(uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
