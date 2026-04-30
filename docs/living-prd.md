# Riverside Fishing Club App - Living PRD

Last Updated: 2026-04-30
Owner: Product + Engineering
Status: Active

## 1) Product Vision

Build a simple, reliable fishing app for club members that:
- helps members find nearby fishing locations quickly,
- logs catches with optional photos,
- supports private spot sharing controls,
- and can scale into a Firebase-backed multi-user app.

## 2) Problem Statement

Current app works well for single-device use, but long-term growth needs:
- scalable backend integration,
- cleaner data contracts,
- secure contact import/upload workflows,
- and clear path from local storage to cloud sync.

## 3) Goals

### MVP Goals (Now)
- Keep current experience stable.
- Add clear search and nearby-location discovery.
- Add documented architecture for scalable growth.
- Add temporary encrypted contacts upload flow (CSV).
- Prepare service layer for Firebase integration.

### Next Goals (Later)
- User auth and role-based club access.
- Cloud-synced catches, spots, and roster.
- Admin tools for roster and invites.
- Analytics and moderation tooling.

## 4) Non-Goals (Current MVP)
- Full backend migration in this phase.
- Complex admin dashboard.
- Real-time multiplayer map collaboration.

## 5) Primary Users
- Club members (beginner to advanced anglers).
- Club admins (future phase for roster and approvals).

## 6) Core User Flows

1. Find nearby fishing spots
   - User opens Home or Spots
   - taps search near me
   - sees ranked nearby spots with directions

2. Log catch with optional photo
   - take photo or upload from device
   - confirm species + length
   - post and optionally share by email

3. Manage spot sharing
   - user selects private spot
   - shares with club or specific allowed members

4. Import temporary contacts CSV (encrypted package)
   - admin/user exports template
   - fills name + email
   - encrypts file
   - app/backend-ready script decrypts and validates

## 7) Functional Requirements

- Nearby spot list under weather: show top 3 spots.
- Spots page search supports text + near-me intent.
- Contact import template supports `first_name,last_name,email`.
- Encryption workflow must support at-rest file protection.
- Service layer abstraction for future Firebase backend.

## 8) Scalability Recommendations (Senior Engineer)

1. Move all data access behind service interfaces.
2. Keep UI components stateless where possible.
3. Define strict DTO contracts for catches/spots/contacts.
4. Introduce feature flags for backend migration.
5. Use Firebase Auth + Firestore security rules from day one of backend launch.
6. Add schema versioning for local data migration.
7. Add observability hooks (errors, usage, sync status).

## 9) Security Requirements

- Sanitize all imported strings.
- Validate emails before persistence.
- Encrypt temporary CSV package using AES-256.
- Do not commit plain sensitive contact data.
- Keep secrets out of repo and prompts.

## 10) Firebase Integration Plan

Phase 1:
- Add Firebase service interface with local fallback.
- Add environment-based config placeholders.

Phase 2:
- Add Firebase Auth.
- Map `spots`, `catches`, and `contacts` collections.

Phase 3:
- Cloud sync + conflict handling.
- Security rules + audit logs.

## 11) Success Metrics

- Nearby spot action usage.
- Catch submission completion rate.
- Search success rate.
- Contact import validation pass rate.
- Error rate during upload/import.

## 12) Open Questions

- Final auth model: email link vs passwordless magic link?
- Club-admin workflow and approval rules?
- Data retention policy for photos and contacts?
