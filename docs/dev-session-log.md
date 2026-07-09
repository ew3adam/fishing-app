---
lastSessionAt: "2026-07-09T00:00:00-05:00"
---

# Dev session log (fishing-app)

## Where we left off

- Reviewed how data (catches, profile, spots) saves to Firebase — requires signed-in
  Firebase Auth account whose email matches Firestore `members` collection.
- Reviewed the SDS folder (`Ideas - Software Design Specification (SDS)/`, one level
  above repo) — long-term Cloudflare + TypeScript + D1 vision documented and saved
  to memory. SDS stays outside repo (privacy — no PII on GitHub).
- Created `CHANGELOG.md` at repo root — full phase history (Phases 1–8) from git log.
- Created `~/.claude/CLAUDE.md` — global Claude Code rule: always use `CHANGELOG.md`
  at repo root; migrate any differently-named files after asking Adam first.
- Committed and pushed `CHANGELOG.md` (`efa49fe`).

## Next

- Member sync pipeline: spreadsheet → Firestore → Firebase Auth (self-service signup).
  Plan was drafted but not approved — pick up with `/plan` next session.
- Roster-gated "set your password" signup flow in app (member sets own password).
- Future: full active roster + Auth accounts synced from spreadsheet via CSV import.

## Save state

Say **save state** — updates this log, runs `npm run scan:pii`, then **commit + push** to GitHub.

Log map: [RFC-PLATFORM-PRD.md](./RFC-PLATFORM-PRD.md) · Firebase log: `../../Firebase/docs/dev-session-log.md`
