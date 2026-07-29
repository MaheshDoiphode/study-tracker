# Study Tracker

Markdown-defined study plans with derived scheduling. Static front end on GitHub Pages, progress and notes in Supabase.

Plans live in git as readable markdown. Progress lives in the database. Dates are never stored — they're computed from your capacity and what you've actually finished, which is what makes editing a plan safe for someone already working through it.

## How it works

```
plans/*.md  ──build──►  docs/data/plans.json  ──fetch──►  browser
                                                             │
                                     progress, notes  ◄──────┘
                                        (Supabase, RLS)
```

## Setup

**1. Supabase**

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor
3. **Authentication → Providers → Email → disable "Enable sign ups"**
4. **Authentication → Users →** add your two users manually
5. Copy the project URL and **publishable key** (`sb_publishable_...`) into `docs/js/config.js`, or set them as the `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` repository secrets so CI injects them

**2. GitHub Pages**

Settings → Pages → Source: **GitHub Actions**. Pushing to `master` validates the plans, compiles them, and deploys.

**3. Local**

```bash
npm run build           # compile plans -> docs/data/plans.json
npm run check           # validate only
npx serve docs          # preview
```

## Writing a plan

Any `.md` file in `plans/` becomes a plan. The structure is always **plan → chapter → section → task**; only the vocabulary changes per domain, so one parser handles DSA, DevOps, and AI alike.

```markdown
---
id: devops-fundamentals
title: DevOps — Fundamentals
domain: devops
labels: { chapter: module, section: lab, task: exercise }
effort: { unit: lab, unitPlural: labs, minutesPerUnit: 90 }
tags: [devops, kubernetes]
---

# Module 1 — Containers `#m1`
> weeks: 1-2 · pace: moderate

## Lab 1 — Docker basics `#m1l1`
> week: 1

- [ ] Build and run your first image `#t-m1l1-build` `@1`
- [ ] Multi-stage builds `#t-m1l1-multistage` `@1.5`
- [ ] Write a compose file `#t-m1l1-compose` `@45m`
```

### Tags

| Tag | Meaning |
|---|---|
| `` `#id` `` | **Required.** Stable identifier — the join key to your progress |
| `` `@6` `` | Effort in the plan's display unit (6 × `minutesPerUnit`) |
| `` `@90m` `` / `` `@2h` `` | Explicit time, overrides the unit conversion |
| `` `~medium` `` | Optional difficulty |

### Rules that the build enforces

- Every chapter, section, and task needs a unique `#id`
- A week range written in a heading must match its `> weeks:` meta line
- Plans must contain at least one task

Checkbox state in markdown is **ignored** — completion lives in the database. The `- [ ]` syntax is only so the file renders as a checklist on GitHub.

### Never change an id

Renaming a title is free. Changing an `#id` orphans that task's history, because ids are how stored progress finds its task.

## Scheduling model

Three facts are persisted: when a plan started, what each task costs, and when tasks were completed. Everything else is derived.

- **Planned finish** — `start + total effort ÷ declared capacity`
- **Projected finish** — `today + remaining effort ÷ measured pace`
- **Drift** — the gap between them

Consequences worth knowing:

- **Editing a plan is safe.** Extending a phase from 3 to 4 weeks changes remaining effort and re-derives the forecast. If you already finished that phase, nothing changes for you at all.
- **Parallel plans compete.** Capacity is a single weekly pool split by each plan's share. Starting a second plan genuinely slows the first, and the projection says so.
- **Pausing is free.** Paused plans consume no capacity and accrue no slippage.
- **Measured beats declared.** Early forecasts use your stated capacity; as history accumulates, your actual pace takes over.

## Changing a plan someone has started

Enrollments pin a snapshot of the plan as it was when started. When a newer version is published, the app shows a diff and lets you accept or stay put.

| Change | Effect on progress |
|---|---|
| Task added | Appears unchecked; effort added to remaining |
| Task removed | History kept, marked orphaned, hidden from active list |
| Task edited | Completion preserved |
| Task moved | Nothing — stable ids follow it |
| Phase duration changed | Schedule re-derives; completed work unaffected |

Nothing in the upgrade path is destructive.

## Security

The publishable key (`sb_publishable_...`) is meant to ship in client-side code — Supabase documents it as safe to expose in web pages and source code. **Row Level Security is what protects your data.** Every table in `schema.sql` has RLS enabled with policies scoped to `auth.uid()`.

When a user signs in via Supabase Auth, the Postgres role becomes `authenticated`, which is what those policies match on.

- Any new table must get the same treatment, or it becomes world-readable and world-writable
- Never put the **secret key** (`sb_secret_...`) or the **postgres connection string** in the front end — both bypass RLS
- Keep sign-ups disabled; create users by hand
- Notes live in Supabase, never in git — this repo is public

## Layout

```
plans/                  plan markdown (public)
scripts/
  parse-plan.mjs        markdown -> plan object
  build-plans.mjs       validate + compile all plans
supabase/schema.sql     tables, RLS policies, triggers
docs/                   GitHub Pages root
  index.html
  styles.css
  js/
    config.js           Supabase credentials
    store.js            all database access
    scheduler.js        date derivation, diffing, velocity
    app.js              views
  data/plans.json       generated — do not edit
```
