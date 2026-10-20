# Momentum

A gentler way to get started.

Momentum is a React + Vite application with Supabase email/password authentication and private task storage. Users can create tasks with optional descriptions and due dates, reorder their dashboard, break tasks into steps, and focus on one next action with an optional five-minute timer. See [SPEC.md](SPEC.md) for product scope.

## Local setup

Use Node.js 22.12+ (or a supported newer LTS release) and npm. From the repository root:

```sh
npm ci
cp .env.example .env
```

Copy the production or development Supabase project's URL and **publishable** key into `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Both variables must be nonempty. The Supabase client throws an explanatory error if either is missing. `VITE_` variables are embedded into the public browser bundle; never use a Supabase secret/service-role key or database password. `.env`, `.env.local`, other environment files, `node_modules/`, `dist/`, and `.vercel/` are ignored by Git. Only the empty `.env.example` should be committed.

```sh
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Restart Vite after changing environment variables. `.env.local` can override `.env`; keep the configured URL and key from the same Supabase project.

## Supabase database setup

Use the Supabase SQL Editor to apply only migrations that have not already been applied, in this order:

1. [20261020000000_create_tasks_and_steps.sql](supabase/migrations/20261020000000_create_tasks_and_steps.sql)
2. [20261020010000_task_details_and_order.sql](supabase/migrations/20261020010000_task_details_and_order.sql)

Paste the entire file into a new query and run it once. Do not rerun an already applied migration or edit it to recreate existing tables. These files are not applied automatically by Vite or Vercel. Confirm existing objects first if the project was set up manually.

The original migration creates tasks and ordered steps, rejects blank titles/descriptions, and cascades task deletion to its steps. RLS limits every CRUD operation to the task owner; step ownership is checked through its parent task. Update policies check the proposed owner/parent as well as the existing row, preventing cross-account transfers. Anonymous access is revoked.

The second migration preserves data while adding optional `description`, `due_at`, and `sort_position` fields. It initializes order separately for each user and adds the authenticated-only `reorder_tasks(uuid[])` function. This function runs as the caller under RLS, validates the submitted task list, and saves the order atomically. Before this migration is applied, the app supports original task/step operations but disables optional details and ordering with a setup message. Apply it for the full production feature set.

The removed starting-plan feature's `starting_time` and `starting_place` columns and existing data remain untouched. Due dates and times are separate and remain supported.

## Supabase authentication setup

In the Supabase dashboard:

- Enable the Email provider and allow sign-ups; keep **Confirm email** enabled.
- For local development, allow `http://localhost:5173` as a redirect URL (adjust for the actual Vite port).
- For production, set **Authentication → URL Configuration → Site URL** to the canonical HTTPS origin from your existing Vercel project's Domains settings. Add that same exact origin to Redirect URLs. Add other domains only if you actually serve the app there. Keep localhost as an additional redirect rather than the production Site URL.
- Configure custom SMTP and a verified sender for public sign-ups. Supabase's built-in mail service is intended for testing and restricts recipients; do not disable email confirmation to work around delivery failures.
- Keep the default confirmation template's `ConfirmationURL` link, or verify that a custom template preserves the verification link and intended redirect.

The app sends `window.location.origin` as the confirmation/resend redirect, so every origin used for sign-up must be allowed. Prefer exact production URLs. For previews, allow only trusted preview URLs and use a separate test Supabase project where practical. See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Sessions persist in browser storage, refresh automatically, and are detected from email confirmation links. UI session checks do not replace database RLS.

## Tests and production build

```sh
npm test
npm run build
npm run preview
```

Vite writes the production bundle to `dist/`; preview serves it locally. Tests mock Supabase and cover authentication, CRUD flows, validation/errors, optional metadata, ordering, step progress, and timer controls. They do not prove live RLS or email delivery. A successful build does not validate the remote Supabase connection or prevent missing environment values from causing an error when the app loads.

## Deploy through the existing Vercel project

These are manual next steps, not actions performed by the readiness review.

1. Open the **existing Momentum project** in Vercel. In **Settings → Git**, verify it is connected to `alexc24028/momentum` and check the configured production branch. The current local branch is `main`; confirm that matches the intended production branch. Do not import a second project.
2. Under project **Build and Deployment** settings, use:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Vite |
   | Root directory | Repository root (`.`), unless the connected repository nests this app |
   | Install command | `npm ci` |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Node.js | Supported LTS, e.g. 24.x; local checks used Node 24 |

   This app uses the root URL with in-page state and no client-side path router, so no SPA rewrite or `vercel.json` is currently required. Follow [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite).
3. Under **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for **Production**, using values from the intended production Supabase project. Configure Preview separately if used. Do not upload `.env` or add privileged credentials. Environment changes apply to a new deployment; see [Vercel environment variables](https://vercel.com/docs/environment-variables).
4. Verify both database migrations, RLS/grants, auth redirect URLs, and SMTP as described above before release.
5. When you decide to release, review and commit the intended tracked changes **and currently untracked application, test, client, environment-template, and migration files**, then push to the branch configured for production. A Git-connected Vercel project normally starts deployment from that push. No commit or push was performed during this review.
6. In the existing project's **Deployments** page, confirm the deployment uses the new commit, inspect build logs, and wait for Ready. Use the project's canonical production domain for testing. Redeploying an old commit before the new files are pushed will not publish this local work. If environment variables change, create a new deployment of the correct commit.
7. Complete the production smoke test below before considering the release verified. If it fails, use Vercel's rollback controls to restore the previous production deployment, then resolve the configuration or application issue.

## Production permissions verification

Review the **live** database, not just the migration files. The following SQL is read-only and can be inspected/run manually in Supabase SQL Editor:

```sql
select relname, relrowsecurity
from pg_class
where oid in ('public.tasks'::regclass, 'public.steps'::regclass);

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('tasks', 'steps');

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name in ('tasks', 'steps')
order by table_name, grantee, privilege_type;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
order by ordinal_position;

select p.proname, p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reorder_tasks';
```

Expect RLS enabled on both tables; four owner-scoped policies on each; authenticated CRUD without anonymous table grants; all new task columns present; and `reorder_tasks` with `security_definer = false`, anonymous execution disabled, and authenticated execution enabled. Inspect any additional permissive policies because they can broaden access. A privileged SQL Editor session can bypass RLS; simply selecting rows there is not an isolation test.

## Production smoke test

- Sign up using a real external email, follow the confirmation link to the production domain, sign out, and sign back in. Verify incorrect-password and expired-link errors, resend behavior, and session restoration after refresh.
- Create a task with a description and due date/time, add several steps, edit them, and complete steps. Check the ordered all-steps list, progress, and final completion message. Refresh and reopen to verify persistence.
- Reorder several cards using a mouse/touch handle and keyboard arrow keys; refresh to verify saved order. Check mobile layouts and keyboard focus.
- Start, pause, resume, and reset the five-minute timer, then let it finish. It keeps the current step visible and does not mark it complete. The timer resets when leaving, refreshing, or changing steps; it sends no notifications.
- Using two separate accounts/browser sessions, confirm each sees only its own tasks and steps. Also test direct API requests with account B's authenticated browser client against known account A IDs: selecting must return no A rows; updates/deletes must affect none; inserting steps into A's task or assigning/transferring a task to A must be rejected; reorder lists containing A's IDs must fail. Use test records and never a service-role key. Signed-out requests must not expose records. This checks database enforcement independently of the UI.
- Delete a test task after confirmation and verify its steps disappear and deletion persists after refresh.

## Readiness review limits

The local review passed the full 30-test suite and production build. A pattern scan of tracked/unignored files found no credential matches; ignored environment files were checked without printing values. Local production-mode configuration contains an HTTPS Supabase URL and a publishable key. Read-only requests to that configured project confirmed Email is enabled, sign-ups are allowed, confirmation is required, and anonymous table reads are denied.

These checks do not establish which Supabase project your existing Vercel project uses. Production Vercel settings, canonical domain, redirect allowlist, SMTP, applied migrations, exact live policies, and authenticated cross-account isolation remain to be verified in the dashboards and smoke tests. No SQL, commits, pushes, or deployments were performed during this review.
