# 14_SECURITY — Security and Permissions

## Status
บางส่วน — derived from handoff and operational rules; must be validated against actual Supabase RLS/current app routes

## Source documents
- `design_handoff_hr_jebar/README.md`
- `AGENT_WORKFLOW.md`
- `HANDOFF.md`

## Non-negotiable rules
1. Employee app must never link employees to admin/owner pages.
2. Do not store API tokens in repo files.
3. Employee data isolation must be enforced server-side, not only by UI.
4. Payroll payment data should not be directly readable by employees if RLS is admin-only; use controlled RPC output.

## Permission matrix from handoff
| Data | Employee | Admin |
|---|---|---|
| General info: phone, idNumber, bank, emergency contact, profile photo, bank QR, ID card image | edit own | edit all |
| Financial/time: rate, payType, commission, branch, work time, late/OT/SS rules, ruleOverrides, closingTasks | read own locked | edit all |
| Attendance | create own check in/out with anti-cheat gates | read/edit all |
| Leave | create own request | approve/reject all |
| Messages | read own thread, reply | send/read all, assign tasks |
| Notification prefs | edit own | — |
| Branches/rules/payroll | no access | full |

## Anti-cheat controls from handoff
- Geofence check based on branch location/radius.
- Selfie requirement if `requireSelfie` is enabled.
- Clock-out can be blocked until closing tasks are completed.

## Missing / ต้องตรวจสอบเพิ่มเติม
- Actual route guards for admin vs employee pages.
- Current RLS policies in Supabase.
- Token/session storage approach.
- Secrets management checklist for Cloudflare/Supabase.
