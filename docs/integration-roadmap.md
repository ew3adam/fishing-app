## Integration Roadmap (Firebase-Ready)

### Goal
Prepare this app for future upgrades without major rewrites.

### Current State
- Frontend is React + Vite.
- Data is mostly local/device-side.
- No backend dependency required to run current product flow.

### Recommended Target Architecture
- UI layer: existing components
- Service layer: central place for business logic and backend calls
- Data adapters:
  - local adapter (today)
  - Firebase adapter (future)

### Immediate Changes Done
- Added `src/services/firebaseAdapter.js` for future Firebase bootstrap/service abstraction.
- Added encrypted CSV tooling for temporary import/export pipeline.

### Future Firebase Integration Tasks
1. Add Firebase config via env variables:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
2. Add Auth (email link or provider sign-in).
3. Move contacts + saved spots to Firestore collections.
4. Add Cloud Functions for invite/send workflows.
5. Add Storage for catch photos and generated previews.
6. Add security rules and audit logging.

### Data Contracts (Draft)
#### contacts
- id (string)
- firstName (string)
- lastName (string)
- email (string, lowercase)
- createdAt (ISO datetime)
- updatedAt (ISO datetime)

#### spots
- id (string)
- name (string)
- lat (number)
- lng (number)
- ownerId (string)
- isShared (boolean)
- sharedWith (array<string>)
- createdAt (ISO datetime)
- updatedAt (ISO datetime)

### Senior Engineering Notes
- Keep all backend reads/writes behind service-layer functions.
- Avoid direct Firebase calls inside UI components.
- Version your import/export file formats.
- Add migration scripts once remote persistence is introduced.
