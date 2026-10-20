# Momentum — Project Specification

## Goal
Build a simple, evidence-informed productivity app that helps
people overcome task initiation difficulties and reduce overwhelm.

The app draws on behavioral activation and strategies for reducing
planning demands. It is not a medical treatment.

## Core Features

### 1. Break It Down
- Users enter a task they are struggling to start.
- Users break the task into small, actionable steps.
- Emphasize one next incomplete step, with an ordered all-steps list below.
- Mark steps complete to move forward.

### 2. Just Start
- Provide an optional 5-minute focus timer.
- Display only the current step during the timer.
- Allow users to stop, pause, or continue without penalties.

## Technology
- Frontend: React + Vite
- Backend and Database: Supabase
- Deployment: Vercel
- Coding Agent: Codex

## Data
- Tasks: ID, user ID, title, optional description, optional due date/time,
  custom sort position, and creation timestamp.
- Legacy starting_time and starting_place columns remain in the database
  for compatibility; the app does not use or change them.
- Steps: ID, task ID, description, completion status.
- Save and load tasks and steps from Supabase.

## Design
- Calm, minimal, mobile-friendly interface.
- One primary action per screen.
- No overwhelming dashboards.
- No streaks, guilt, or productivity scores.
- Clear loading, empty, and error states.

## Edge Cases and Security
- Reject empty task titles and steps.
- Allow users to edit and delete tasks.
- Deleting a task also deletes its steps.
- Show errors when database operations fail.
- Do not collect medical or symptom information.
- Use appropriate database permissions.

## Out of Scope
- When-and-where starting plans.
- AI-generated steps.
- Mood tracking.
- Energy-level filtering.
- Notifications.
- ADHD diagnosis or treatment.
- Advanced analytics.

## Definition of Done
- [ ] Users can create tasks and actionable steps.
- [ ] Users can focus on one step at a time.
- [ ] Tasks and steps persist in Supabase.
- [ ] App is deployed publicly through Vercel.
- [ ] Code is available on GitHub.
- [ ] Core features have been tested.