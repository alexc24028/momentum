# Momentum project guidance

- Read `SPEC.md` before changing product behavior. Preserve it unless the user requests changes.
- Use React + Vite. Supabase is the planned authentication/database service, and Vercel is the planned deployment target.
- Keep changes within the requested implementation stage. The current stage is a welcome screen only; the Get Started button intentionally has no workflow yet.
- Keep the interface calm, minimal, accessible, and mobile-friendly, with one primary action per screen. Avoid streaks, guilt, scores, and overwhelming dashboards.
- Use semantic HTML, visible keyboard focus, readable contrast, and touch-friendly controls.
- Do not collect medical or symptom information or present Momentum as medical treatment.
- When Supabase is introduced, require authentication and row-level security for tasks and steps. Enforce ownership in the database, including through each step's parent task. Never expose service-role or other privileged credentials in frontend code.
- Keep secrets and generated artifacts out of Git. Commit the npm lockfile with dependency changes.
- Run `npm run build` after implementation changes. Add behavioral tests when meaningful workflows are introduced.
- Do not commit or deploy unless the user requests it. Preserve existing Git history.
