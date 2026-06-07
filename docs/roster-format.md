# Club roster format — Fishing App (Phase 2)

Roster members must exist in Firebase project **rfc-management** (`members` collection) before they can sign in. This file describes the **local import** format for sharing pickers and offline directory until cloud roster is loaded.

## Required fields

| Field | Rules |
|-------|--------|
| `memberId` | Unique; matches Firestore doc id, e.g. `adam_bielawski` |
| `firstName` | Required; trimmed |
| `lastName` | Required; trimmed |
| `email` | Required; lowercase; valid format; **no duplicates** |
| `phone` | Digits only in file (`6304601140`); display as `(630) 460-1140` |
| `active` | `true` or `false` — inactive cannot sign in |
| `role` | `member` or `admin` |

## CSV header row

```csv
memberId,firstName,lastName,email,phone,active,role
adam_bielawski,Adam,Bielawski,photobra@gmail.com,6304601140,true,admin
```

## JSON array

See [`data/seeds/club-roster-v1.json`](../data/seeds/club-roster-v1.json) — Adam seed row only (no passwords).

## Validation on import

- Reject invalid email format
- Reject duplicate `email` or `memberId`
- Reject missing `firstName` or `lastName`
- Sanitize: trim strings; email → lowercase; phone → digits only

## Storage

Imported roster caches to `localStorage` key `rfc_club_roster_v1`.

When signed in, the app prefers the live Firestore `members` list for the club directory.

## CRM link

Full membership data (dues, address, meetings) is imported via `Desktop/RFC/Firebase` scripts into the same `members` collection.
