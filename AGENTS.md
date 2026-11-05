# Parola

A personal, offline-capable language practice app. Scope: vocabulary and grammatical structures in French, German, Italian, and Portuguese, prompted from Spanish or English. German defaults to English; the others default to Spanish.

## Working here

- Standing owner approval ("approve everything", "you choose", "keep going",
  "do all the work") covers the focused offline-worker repair, its nineteen
  new VM cases, three authored browser cases and temporary public CI capped
  at twenty minutes per scoped attempt. See
  `docs/proposals/offline-worker-checks.md`; do not repeat the old approval
  question for that scope. No account, paid plan or notification enrollment.
- Five pre-existing dirty/untracked files are excluded from this repair:
  `.gitignore`, `README.md`, `docs/acceptance.md`,
  `.github/workflows/hosted-browser.yml`, `tests/hosted.spec.mjs`.
  Preserve their bytes and stage only explicitly owned paths. Never claim
  the native checkout is globally clean while these changes remain.

- Preserve user progress and existing work.
- This is a dependency-free static ES module application in `public/`, published on Vercel. Do not add a framework or dependencies without a concrete need.
- Use `apply_patch` for source changes.
- Keep learner data local; escape user content before rendering it as HTML.
- Node 22's built-in test runner checks the learning engine and data contracts. Do not run dev servers or browser smoke checks without the user's explicit authorization.
- Run `git diff --check` and targeted syntax/import checks after changes.
- Daily background reminders use an exported recurring calendar event. Browser notifications require permission and an open app; never imply background push is implemented.
- Keep acceptance and deployment evidence under `docs/` and distinguish source checks, hosted HTTP checks, and browser checks.
