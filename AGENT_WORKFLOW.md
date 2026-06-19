# JEBAR HR Agent Workflow

Last updated: 2026-06-19

This file is the working rulebook for the coding agent that maintains HR JEBAR.

## Project

- App: HR JEBAR / JEBAR Operations System
- Live URL: https://hr-jebar.pages.dev
- Local working copy:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy`
- App folder:
  `app`
- Build output:
  `app\dist`
- Cloudflare Pages project:
  `hr-jebar`
- GitHub repo:
  `https://github.com/numjebar/HR-JEBAR`

## Non-Negotiable Safety Rules

1. Employee app must never link employees to admin/owner pages.
2. Attendance check-in/check-out must keep working before every deploy.
3. Payroll changes must be tested with real employee examples before deploy.
4. Every visible deploy must update the build badge in `app/src/lib/version.js`.
5. Do not store API tokens in repo files.
6. Run build before deploy.
7. Update `HANDOFF.md` after any meaningful change.

## Standard Work Loop

1. Read the newest user request and identify scope.
2. Inspect only the files related to that scope.
3. Make the smallest safe code change.
4. Run targeted checks.
5. Run `npm.cmd run build`.
6. Update version badge.
7. Update `HANDOFF.md`.
8. Deploy only when requested or when the agreed batch is complete.
9. Verify production URL and version badge after deploy.

## Commands

```powershell
cd C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app
npm.cmd run build
```

Deploy manually:

```powershell
cd C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy
$env:CLOUDFLARE_API_TOKEN="PASTE_TOKEN_HERE"
npx.cmd wrangler pages deploy app/dist --project-name hr-jebar
```

## GitHub Actions Secrets Needed

Repository: `numjebar/HR-JEBAR`

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The token must have Cloudflare Pages edit/deploy permission for the account that owns `hr-jebar`.

## Current Payroll Rule

- `employees.rate` means daily wage in baht/day.
- `employees.pay_type` means payment cycle only:
  - `daily`: daily pay cycle
  - `weekly`: weekly pay cycle
  - `monthly`: monthly pay cycle
- Weekly cycle starts from `employees.weekly_cycle_start_day`.
- Monthly cycle starts from `employees.monthly_cycle_start_day`.
- Regular off days come from `employees.day_off`.
- Base pay for the current cycle is:
  `daily wage x payable days in selected/current cycle`

## Current Open Concern

The user wants payroll to be understandable per day:

- Show each date in the pay cycle.
- Show work / late / leave / absent / regular off day.
- Show advances and deductions attached to the exact date.
- Allow admin to edit a day by date.
- Eventually add a persistent "paid already" marker per date or per cycle.

