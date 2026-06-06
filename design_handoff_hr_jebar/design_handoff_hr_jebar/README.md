# Handoff: HR JEBAR — ระบบลงเวลา & คำนวณเงินพนักงาน (multi-branch, cross-device synced)

## Overview
HR JEBAR is a staff time-clock + payroll system for small-to-medium Thai shops/businesses with **multiple branches**. It has two roles:
- **Employee app** (mobile) — clock in/out with anti-cheat (GPS geofence + selfie), request leave, view their own pay (daily/weekly/monthly), two-way chat with admin, edit their own *general* profile info, read shop rules. Each employee sees **only their own data**.
- **Admin console** (desktop) — manage employees, branches, per-branch and per-person rules, payroll calculation, line-item bonuses/deductions, leave approval, send messages/assign tasks per person, read receipts.

The current prototype (in this bundle) is a **single-file HTML app using `localStorage`** — data lives per-browser and does **not** sync across devices. **The goal of this handoff is to re-implement it as a real cross-device app with a central database, real authentication, and live sync**, so employees use their own phones and the admin sees everything in real time.

## About the Design Files
The files in this bundle are **design references created in HTML/React (via Babel-in-browser)** — working prototypes that show the intended look, flow, and business logic. They are **not** production code to ship as-is. Recreate them in a real stack of your choice (recommended below) using a proper backend. The payroll/geofence/rules logic in `app/store.jsx` is correct and battle-tested in the prototype — **port that logic directly** (it's the most valuable part).

## Fidelity
**High-fidelity.** Colors, typography, spacing, component styling, and interactions are final. Recreate the UI faithfully. Thai language throughout.

---

## Recommended Architecture (for the synced version)
- **Backend/DB + Auth + Realtime:** Supabase (Postgres + Row-Level Security + Realtime + Storage) is the best fit. Firebase (Firestore + Auth + Storage) also works.
- **Frontend:** React (the prototype is already React) — reuse component structure. Or React Native / Flutter for true mobile apps.
- **Auth model:**
  - Admin: email/password (or phone OTP) with an `admin` role.
  - Employees: phone number + 4-digit PIN (as in prototype), or phone OTP. Each employee row has an `auth_user_id`.
- **Row-Level Security (critical — enforces "employee sees only own data"):**
  - Employees can `SELECT/UPDATE` only rows where `employee_id = auth.uid()` **and only on general-info columns** (see permissions matrix below).
  - Admin role can read/write everything within their `org_id`.
- **File storage:** profile photo, bank QR, ID card, check-in selfies → Supabase Storage / Firebase Storage (prototype stores base64 in localStorage; replace with uploaded file URLs).
- **Realtime:** subscribe to `messages`, `attendance`, `leaves` so admin dashboard badges and employee notifications update live (replaces the prototype's in-memory store).

---

## Data Model
Port these entities (from `app/store.jsx`). Types are guidance; use real FKs + `org_id` on every table for multi-tenant safety.

### branch
| field | type | notes |
|---|---|---|
| id | uuid | |
| label | text | e.g. "สาขาสยาม" |
| lat, lng | float | geofence center |
| radius | int | meters (default 20) |
| rules | jsonb | **per-branch** rule overrides (see Rules object); merged over global defaults |
| shopRules | text[] | shop regulations shown in employee app for this branch |

### employee
| field | type | notes |
|---|---|---|
| id | uuid | |
| name, nickname, position, department | text | |
| phone, idNumber | text | **employee-editable** |
| payType | enum `daily`/`monthly` | **admin-only** |
| rate | number | THB/day or THB/month — **admin-only** |
| startDate | date | |
| bankName, bankAccount | text | **employee-editable** |
| commission | jsonb `{type:'none'|'percent'|'unit', value:number}` | **admin-only** |
| emName, emRel, emPhone | text | emergency contact — **employee-editable** |
| notes | text | admin-only (general notes) |
| branchId | fk → branch | **admin-only** (determines which geofence + rules apply) |
| closingTasks | text[] | **admin-only** — per-person checklist required before clock-out |
| ruleOverrides | jsonb | **admin-only** — per-person rule overrides (merged last, see hierarchy) |
| color | text | avatar fallback color |
| pin | text | 4-digit; replace with hashed auth in real app |
| photo, bankQR, idCardImg | file URL | **employee-editable** (uploads) |

### attendance (one row per employee per day)
| field | type | notes |
|---|---|---|
| id, empId, date (YYYY-MM-DD) | | |
| clockIn, clockOut | "HH:MM" | |
| status | enum `present`/`late`/`leave`/`absent` | computed: late if clockIn > workStart+grace |
| otMin | int | minutes after workEnd |
| leaveType, paid | | for leave rows |
| checkin | jsonb `{selfie, dist, lat, lng}` | anti-cheat proof |
| closingDone | text[] | closing tasks ticked at clock-out |

### sale (commission source)
`{id, empId, date, amount, units, note}`

### adjustment (money line items — bonuses & deductions)
`{id, empId, date, type, amount, note, auto}` — `type`: `bonus` (add), `damage`/`advance`/`other` (deduct). `note` = reason (required in UI). `auto:true` for system-generated (e.g. urgent-leave penalty).

### leave
`{id, empId, type, dateFrom, dateTo, reason, status, urgent}` — `status`: `pending`/`approved`/`rejected`. `type`: ลาป่วย/ลากิจ/ลาพักร้อน. `urgent:true` if filed same-day after work start with no reason → triggers auto-deduction.

### message (two-way chat + tasks)
`{id, empId, from:'admin'|'emp', kind:'message'|'task', text, due, createdAt, status, readAt}` — `status` for admin→emp: `unread`/`read`/`done` (read receipts); for emp→admin: `unread` until admin opens the thread.

### prefs (per-employee notification settings)
`{[empId]: {sound:bool, vibrate:bool, tone:string}}`

### Rules object (global defaults → branch.rules → employee.ruleOverrides, merged in that order)
```
workStart "09:00", workEnd "18:00", workHours 8, graceMin 5,
lateMode 'tiered'|'permin',
  // tiered: lateBigMin 30 (over→deduct now), lateMinorMin 15, lateMinorCount 3, lateDeductHours 1
  // permin: lateDeductPerMin 2 (THB/min after grace)
otMode 'multiplier'|'fixed', otMultiplier 1.5, otRatePerHour 80,
ssMode 'percent'|'fixed', ssPercent 5, ssMax 750, ssAmount 750,
urgentLeaveDeductDays 2,
geoEnabled true, requireSelfie true   // these two are GLOBAL only (not per-branch)
```

---

## Payroll Engine (port verbatim from `computePay` in app/store.jsx)
Given an employee, their attendance/sales/adjustments in a period, and their **effective rules** (`rulesFor` = global ⊕ branch ⊕ person):
- **hourlyRate** = daily: rate/8 ; monthly: rate/(26×8). **dayRate** = daily: rate ; monthly: rate/26.
- **base** = sum of dayRate for each present/late/paid-leave day.
- **late deduction:**
  - `permin`: total late minutes × lateDeductPerMin.
  - `tiered`: each day late > lateBigMin → 1 unit; days late between lateMinorMin and lateBigMin accumulate, every `lateMinorCount` of them → 1 unit; deduction = units × lateDeductHours × hourlyRate.
- **OT pay** = (otMin/60) × (fixed: otRatePerHour ; multiplier: hourlyRate × otMultiplier).
- **commission** = percent: Σ amount×pct/100 ; unit: Σ units×perUnit.
- **adjustments**: bonus adds; damage/advance/other deduct.
- **gross** = base + otPay + commission + bonus.
- **social security (ss)** = fixed: ssAmount ; percent: min(gross×ssPercent/100, ssMax).
- **net** = gross − (lateDeduct + damage + advance + other + ss).

**Periods:** day = today; week = Mon–Sun; month = calendar month.

---

## Permissions Matrix (enforce server-side with RLS)
| Data | Employee | Admin |
|---|---|---|
| General info (phone, idNumber, bank, emergency contact, profile photo, bank QR, ID card image) | **edit own** | edit all |
| Financial/time (rate, payType, commission, branch, work time, late/OT/SS rules, ruleOverrides, closingTasks) | **read own (locked)** | edit all |
| Attendance | create own (clock in/out, gated by geofence+selfie+closing checklist) | read/edit all |
| Leave | create own request | approve/reject all |
| Messages | read own thread, reply | send/read all, assign tasks |
| Notification prefs | edit own | — |
| Branches & rules & payroll | — | full |

---

## Screens / Views
See the live prototype for exact layout. Summary:

**Employee app (mobile, ~390px frame, bottom tab bar):**
1. **Login** — pick employee card → 4-digit PIN pad.
2. **หน้าหลัก (Home)** — greeting + bell (unread count badge); **prominent red alert card** if unread admin messages; dark clock card with live time, branch name, today's in/out, big Clock-in/out button (state machine: in→out→done); week mini-stats (worked/late/OT); assigned-tasks card; shop-rules card (opens sheet).
3. **Check-in/out flow (bottom sheet)** — geolocating → in-zone/denied (mini map) → (clock-in) selfie capture → (clock-out) **closing checklist** (must tick all) → confirm → **success screen** (green check, time, branch, selfie). Has a demo "simulate location in/out-of-zone" toggle — remove in production, use real `navigator.geolocation`.
4. **ประวัติ (History)** — attendance list + leave list; "ขอลาใหม่" sheet (warns about urgent-leave penalty).
5. **รายได้ (Pay)** — period toggle; green net-pay card; itemized breakdown (+earnings / −deductions).
6. **ข้อความ (Messages)** — chat bubbles (admin left / employee right), task bubbles with "ทำเสร็จแล้ว", reply input. Tab badge with unread count.
7. **โปรไฟล์ (Profile)** — notification settings (sound on/off + **5 tone choices** with preview, vibrate, lock-screen preview); **editable** general info (edit sheet) + uploadable docs; **locked** financial/time card.
8. **Lock screen + push banner** — iOS-style notification when message arrives (sound via WebAudio, vibrate via navigator.vibrate).

**Admin console (desktop, left sidebar + content, max 1180px):**
1. **ภาพรวม (Dashboard)** — 4 stat tiles (working now / late today / on leave / month payroll total); today status list; **red alert card** if employees replied; pending leave approvals; quick actions.
2. **พนักงาน (Employees)** — searchable card grid; add/edit employee modal (all fields incl. branch, commission, closing tasks); **employee detail**: profile card + per-person rules button, documents, period toggle, green pay breakdown, money line-items list (add/delete bonuses & deductions with reason), attendance list (with selfie thumbnails + distance + closing-done), send-message, edit.
3. **การลงเวลา (Attendance)** — per-day table of all staff.
4. **คำนวณเงิน (Payroll)** — branch filter chips; period toggle; totals; per-employee table with branch column; net per person.
5. **ข้อความ & สั่งงาน (Messages)** — employee tiles with reply badges; conversation modal (send message or assign task w/ due date; read receipts ✓ / ✓✓ อ่านแล้ว+time / ทำงานเสร็จ).
6. **ตั้งค่ากฎ (Settings)** — **per-branch** rule editor (branch chip selector): work time, late rule (tiered/permin), OT (multiplier/fixed-baht), SS (percent/fixed-baht), leave penalty, per-branch shop rules; global anti-cheat toggles (geofence, require selfie); **Branch Manager** (add/edit/delete branches, radius, lat/lng, GPS button, **and a location parser that accepts Google Maps URL / "lat,lng" / Plus Code incl. short codes with Thai province names** — see `parseLocation` + `OLC` + `THAI_PROVINCES` in store.jsx, port these); "เริ่มใช้งานจริง" (clear demo) and reset.

## Interactions & Behavior
- Clock-in disabled unless inside branch geofence radius; selfie required if `requireSelfie`; clock-out blocked until all closing tasks ticked.
- Late status auto-computed; pay recalculates live.
- Urgent same-day leave with no reason → auto-creates a deduction adjustment (`urgentLeaveDeductDays` × dayRate).
- Notifications: WebAudio tone + `navigator.vibrate` + in-app banner + lock screen + count badges (employee side) ; sidebar/dashboard/per-employee badges (admin side). Mark-read on open.
- Read receipts on admin→employee messages.

## Design Tokens
```
--accent #0E7C66 (brand green; also offer gold #9A6B2F, blue #1D4ED8, etc. as theme options)
--accent-soft #E6F4EF
--ink #15191E      --muted #6B7280
--bg #F3F4F6       --surface #FFFFFF      --line #E5E7EB
font: 'IBM Plex Sans Thai' (Thai), 'IBM Plex Sans' (Latin/numbers)
radius: cards 16–22, inputs 11–12, pills 999
status colors: late/warn #B45309 (bg #FEF3E2); danger #B91C1C/#DC2626 (bg #FEE2E2); leave #4338CA (bg #EEF2FF)
shadow: cards use 1px var(--line) border, not heavy shadows; modals 0 30px 70px rgba(0,0,0,.3)
slide/number text: font-variant-numeric: tabular-nums everywhere money/time shown
```

## Assets
- **Logo:** `assets/jebar-logo.png` (JEBAR wordmark + gold triangle/droplet) — included.
- **Icons:** inline stroke SVG set (24-grid) defined in `app/ui.jsx` (`ICON_PATHS`). Replace with your icon library (lucide/heroicons) matching stroke style.
- **No external image assets** otherwise; avatars are colored initials unless a photo is uploaded.

## Files in this bundle
- `index.html` — entry (fonts, CSS tokens, script load order).
- `app/store.jsx` — **data model, seed data, payroll engine (`computePay`), rules hierarchy (`rulesFor`), geofence (`geoDistance`), Plus Code parser (`OLC`, `parseLocation`, `THAI_PROVINCES`), period helpers. Port this logic.**
- `app/ui.jsx` — shared UI primitives + icon set.
- `app/employee.jsx` — employee app screens + shell.
- `app/employee-checkin.jsx` — geofence + selfie + closing-checklist + success flow.
- `app/admin.jsx` — dashboard, employee list, add/edit employee modal.
- `app/admin-ops.jsx` — employee detail, attendance, payroll, messages, settings, branch manager, per-person rules modal.
- `app/main.jsx` — role picker, admin shell/sidebar, root, theme tweaks.
- `app/notify.jsx` — sound (WebAudio tones), vibrate, in-app banner, lock screen.
- `frames/ios-frame.jsx` — device bezel (prototype only; drop for real mobile build).
- `HR JEBAR.html` — bundled single-file build of the current prototype (for reference/demo).

## Notes
- Replace base64 image storage with real file uploads.
- Replace 4-digit PIN with proper auth + hashing; PINs in seed are demo-only.
- Remove the "simulate location" demo toggle; use real geolocation with permission handling.
- Keep the global→branch→person rules merge order — it's central to correctness.
- Thai Buddhist year (พ.ศ. = +543) is used in some date displays.
