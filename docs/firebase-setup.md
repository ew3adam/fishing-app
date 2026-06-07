# Firebase setup — Fishing App + RFC CRM

**Shared project:** `rfc-management` (same as `Desktop/RFC/Firebase`).

## 1. Enable Authentication

Firebase Console → Authentication → Sign-in method:

- **Email/Password** — enable (required now)
- Google, Facebook, Phone — enable later when API IDs are in `.env.local`

Create Adam’s account in Console (email `photobra@gmail.com`) — password **not** in this repo.

## 2. Member roster

Members live in Firestore collection `members` (imported from CRM CSV). Document ID example: `adam_bielawski`.

Sign-in checks `members.email` (lowercase) and `isActive === true`.

## 3. Firestore rules (add in Console or deploy `firestore.rules`)

The fishing app needs signed-in members to read the roster and read/write their own fishing data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isSelfMember(memberId) {
      return signedIn()
        && get(/databases/$(database)/documents/members/$(memberId)).data.authUid == request.auth.uid;
    }
    match /members/{memberId} {
      allow read: if signedIn();
      allow update: if signedIn()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['authUid', 'lastFishingAppLoginAt']);
      match /fishingProfile/{docId} {
        allow read, write: if isSelfMember(memberId);
      }
      match /fishingCatches/{catchId} {
        allow read, write: if isSelfMember(memberId);
      }
    }
  }
}
```

Adjust if your CRM rules already exist — merge, do not replace blindly.

## 4. Local env

Copy `.env.example` → `.env.local` (gitignored). Values are in `Desktop/RFC/Firebase/src/firebase.js`.

## 5. Cross-device sync paths

| Data | Firestore path |
|------|----------------|
| Fishing profile | `members/{memberId}/fishingProfile/main` |
| Catches | `members/{memberId}/fishingCatches/{catchId}` |
