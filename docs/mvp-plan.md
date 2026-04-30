# RFC Fishing App MVP Plan (Scalable Foundation)

## Goal
Ship a stable MVP that is easy to scale and ready for Firebase backend integration.

## MVP Features (Now)
1. **Core UX**
   - Home with weather + nearby fishing locations
   - Spots with local/salmon/favorites + near-me search
   - Catch log with image upload/camera + ruler overlay + length options
2. **Member Sharing**
   - Allowed email roster
   - Invite/share by approved club email
3. **Data Handling**
   - Sanitize all user text input
   - Keep local-first behavior while backend is optional
4. **Temporary Contact Upload**
   - Import CSV of `name,email`
   - Encrypt contact data file at rest before sharing/upload

## Out of Scope (Later)
- Full account auth and RBAC
- Real-time collaboration
- Payment/subscriptions
- Advanced analytics dashboards

## Non-Functional Requirements
- Mobile-first responsive UI
- Minimal bundle growth per feature
- Service-layer abstraction for all future backend calls
- Backward-compatible local data structures

## Architecture Decisions
- **Frontend:** React (existing)
- **Service Layer:** `src/services/*` for APIs and adapters
- **Backend-ready Contract:** typed payload shapes and key names stable over time
- **Data Export/Import Scripts:** Node scripts under `scripts/`

## Release Strategy
1. Stabilize UI and local data model
2. Add Firebase adapter behind service layer
3. Incrementally switch write/read paths from local to backend
4. Keep rollback path to local cache

## Risks + Mitigations
- Risk: Local and backend schema drift  
  - Mitigation: shared schema map and migration version in profile payload
- Risk: Sensitive contact file exposure  
  - Mitigation: AES encryption script + `.gitignore` for encrypted temp data
- Risk: Mobile icon/update cache confusion  
  - Mitigation: icon cache-busting and reinstall guidance

