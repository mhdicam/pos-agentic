# RD-14 Tenant team (roles, PIN, attendance, blind close) — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-11
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Benchmark: [`tenant back-office benchmark`](../references/2026-11-10-tenant-backoffice-benchmark.md) §3 Staff (V1, H1, H2, S2, J2, J3, S1/V3) and §7 Cash management (V2, O2, M8, T2, O3). Prototype contract: `CONTRACT.md` (Extension points, `Orbis.hooks.can`).

| Screen (route) | FR / benchmark | API (`Orbis.domain.team`) | Data | Permission | Tests (`tests/x-team.test.js`) |
|---|---|---|---|---|---|
| Tim & Outlet (`team`) | J2 staff record, S1 outlet scope | `saveStaff`, `setPin` | `staff.{phone,email,outlets,pinHash,pinFails,pinLocked}` | `team.write` | profile validation; PIN |
| Peran & Izin (`roles`) | V1 POS vs BO toggles, H1 three-state | `setPerm`, `resetRole`, `mode`, `Orbis.hooks.can` | `rolePerms[{tenant,role,perm,mode}]` | `team.write` | overrides; approval; owner guard |
| POS approval | H1/V1 manager PIN override | `approve`, `withApproval`, `consume` | `session.approval{perm,tenant,by,exp}` | approver = owner or manager allowed for perm | approval consumed once |
| Absensi (`attendance`) | J3 clock-in by PIN | `clockIn`, `clockOut`, `attendance`, `duration` | `attendance[{staffId,outlet,inAt,outAt}]` | `attendance.clock`, `attendance.read` | double clock-in |
| POS tutup kasir | V2/O2 blind close, T2 denominations | `countDenoms`, `blindClose` (calls `shifts.close`) | `shifts` | `shift.operate`, `shift.viewExpected` | blind close |
| Riwayat Shift (`shifts`) | M8/O3 shift report, export/print | `shiftReport` | `shifts`, `payments.shiftId`, `cashEvents` | `shift.report` | blind close; isolation |

Slice: Batch 4 (team & cash) of the tenant back-office prototype.

## Acceptance Criteria (EARS)
- **RD14-01** (Ubiquitous): The system shall resolve a tenant role's permission from the session tenant's `rolePerms` override (Diizinkan/Ditolak) and, when no override exists, from the default `Orbis.PERMS`; with no overrides the hook shall return undefined. Tests: `team: no overrides = hook returns undefined (defaults unchanged)`, `team: override deny and allow per tenant role`.
- **RD14-02** (Event-driven): When an action whose rule is "Perlu PIN manajer" is attempted, the system shall deny it unless a valid owner/manager PIN approval for that exact permission exists; the approval shall expire after 2 minutes and be consumed after one action. Tests: `team: approval-required needs manager PIN and is consumed once`.
- **RD14-03** (Unwanted): If anyone tries to reduce the owner's permissions, override `team.write` or `platform.*`, or change the owner's role/status, then the system shall reject with `OWNER_PROTECTED`/`VALIDATION` and the owner shall keep every permission. Tests: `team: owner cannot be reduced, team.write not overridable, non-owner cannot edit roles`.
- **RD14-04** (Unwanted): If a non-owner edits role rules, staff or PINs, then the system shall reject with `FORBIDDEN`. Tests: `team: owner cannot be reduced, team.write not overridable, non-owner cannot edit roles`.
- **RD14-05** (Event-driven): When the owner saves a staff profile, the system shall validate name (2-60), Indonesian phone, email, a tenant role and at least one outlet of the session tenant, enforce the plan's active-staff limit, and audit the change. Tests: `team: staff profile validation, outlets of own tenant, plan limit`.
- **RD14-06** (Ubiquitous): Each staff PIN shall be 4-6 digits, unique within the tenant, and stored only as a salted hash string (prototype hash; production hashes server-side). Tests: `team: PIN format, uniqueness per tenant, lockout after 5, owner reset`.
- **RD14-07** (Unwanted): If a PIN is entered wrong 5 times, then the system shall lock it (even for the correct PIN) until the owner sets a new PIN. Tests: `team: PIN format, uniqueness per tenant, lockout after 5, owner reset`.
- **RD14-08** (Event-driven): When a staff clocks in or out with their PIN, the system shall record the session outlet and time; it shall reject a second clock-in while one is open (`ALREADY_CLOCKED_IN`), a clock-out without clock-in, and an outlet the staff is not assigned to. Tests: `team: clock-in by PIN, no double clock-in, outlet assignment, duration`.
- **RD14-09** (State-driven): While a role lacks `shift.viewExpected` (cashier by default), the POS shall not show expected cash and closing shall ask only for the counted amount (per denomination or total); after submit the system shall show variance and a Z-report. Tests: `team: blind close reports variance and Z-report by tender`.
- **RD14-10** (Ubiquitous): The Z-report shall list opening cash, sales by tender (cash/qris/transfer/cod from `payments.shiftId`), cash in/out, refunds, expected vs counted, variance and cashier; closing shall go through `shifts.close` so a non-zero variance still requires a note. Tests: `team: blind close reports variance and Z-report by tender`.
- **RD14-11** (Unwanted): If a user of another tenant reads staff, role rules or a shift report, then the system shall not expose them (`NOT_FOUND`, rules not applied). Tests: `team: other-tenant isolation for overrides, staff, reports`.
- **RD14-12** (Optional): Where demo data is generated, the system shall add a BSD barista and a dispatcher with PINs and ~2 weeks of attendance via real clock-in/out. Tests: `team: demo adds 2 staff and ~2 weeks attendance`.

## Design notes
- Approval token lives in `d.session.approval` (persisted, same tab). `withApproval(pin, perm, fn)` = approve → `Orbis.batch(fn)` → consume in `finally`. A manager can approve only permissions managers hold outright.
- Demo PINs: Rina 1111, Dewa 2222, Sari 3333, Bima 4444; after "Isi data demo": Putri 5555 (BSD), Wawan 6666. Extra staff are added in the demo hook, not the base seed, so t1 stays within the Starter staff limit used by platform downgrade checks.
- New permission keys: `attendance.clock`, `attendance.read`, `shift.viewExpected`, `shift.report`.

## Open review gates
- Browser-local prototype only; server authorization, PIN hashing/rate limiting, concurrency and production integrations are not covered.
- Selfie photo at clock-in (J3), attendance edit requests (S9), reopen closed drawer (T2) and outlet-scoped data visibility (S1) are not implemented.
- Decision request: should approval tokens be per device (POS) rather than per session?
