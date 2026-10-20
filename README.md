# Momentum

A gentler way to get started.

Momentum is a calm, mobile-friendly productivity app built with React and Vite. This initial version contains only the welcome screen. The **Get Started** button is a visual placeholder; it does not navigate or start a workflow yet.

## Local setup

Use Node.js 22.12 or later and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

## Production build

```sh
npm run build
npm run preview
```

The build output is in `dist/`. The preview command serves that output locally.

## Project scope

See [SPEC.md](SPEC.md) for the full product specification. Authentication, Supabase storage, task breakdown, starting plans, and the focus timer are planned features and are not implemented. No environment variables are required for this version.

The app is intended for eventual deployment on Vercel using `npm run build` and the `dist` output directory. It has not been deployed as part of this setup.
