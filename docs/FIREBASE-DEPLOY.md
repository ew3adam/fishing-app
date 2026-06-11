# Firebase deploy — fishing app data rules

Project: **rfc-management**

## Deploy security rules (required for cloud save + club feed)

From this folder (`fishing-app/firebase`):

```bash
firebase deploy --only firestore:rules,storage --project rfc-management
```

Rules live in:

- `firebase/firestore.rules` — roster read, fishing profile, catches, feed likes
- `firebase/storage.rules` — catch photo uploads

## Roster + Auth checklist

1. **Firestore** `members` collection has each angler with `email`, `isActive: true`, `firstName`, `lastName`
2. **Firebase Auth** account created for each member email (password min 10 chars)
3. Member signs in on **Profile** tab — app links `authUid` on their member doc
4. **Profile tab** shows roster health: active member count (or error if rules block read)

## What saves where

| Data | Local | Cloud path |
|------|-------|------------|
| Catch log | `localStorage` | `members/{id}/fishingCatches/{catchId}` |
| Catch photo | data URL on device | Firebase Storage `members/{id}/catches/{catchId}/photo.jpg` |
| Private spots | profile in `localStorage` | `members/{id}/fishingProfile/main` |
| Club feed | read from cloud | catches with `visibility: club` |
| Feed likes | `localStorage` who you liked | `likeCount` on catch doc (all members can increment) |

## Test end-to-end

1. Member A signs in → logs catch → **Share with club**
2. Member B signs in → Home → **Club Feed** → sees A’s post
3. Member A shares a spot (Share with club) → Member B → Spots → Club map → sees A’s pin
