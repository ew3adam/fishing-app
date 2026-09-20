---
description: Save State. Sync GitHub, commit, push, back up to the Mac and T7 drive, and verify.
---

# Save State (RFC Fishing App)

Run this when Adam types /save-state or says "save state".
GitHub is the source of truth. Adam works on many platforms (Mac, iPhone, Claude Code cloud).
Use zsh or bash only. Never use PowerShell. Never force push. Never print passwords or keys.

## Locations

- Repo: current working folder (must be the fishing-app repo)
- Mac copy: /Users/ew3adam/fishing-app
- T7 backup: /Volumes/T7 Shield/Clients/RFC/Fishing-App/fishing-app

The Mac and T7 paths only exist on Adam's Mac. On other platforms they do not exist. Skip them and say so.

## Steps

1. Check GitHub first
   - Run `git fetch origin`.
   - Run `git status -sb`.
   - If the repo is behind origin and has no local changes: run `git pull --ff-only`.
   - If the repo is behind AND has local changes: STOP. Show `git status`. Ask Adam what to do.
   - If the pull is not a fast forward: STOP and ask.

2. Commit
   - If there are no changes, say "nothing to commit" and go to step 4.
   - Never commit ftp_config.json, .env files, or any file with passwords or keys.
   - If docs/dev-session-log.md exists, add a short dated entry at the END of the file. Only append. Do not edit old entries.
   - Run `git add -A`, then commit with the message `Save state YYYY-MM-DD`. Use today's date. Adam can give a custom message.

3. Push
   - Run `git push origin main` (use the default branch name if it is not main).
   - If the push is rejected, STOP and report. Do not force push.
   - Cloudflare Pages deploys on push. No manual deploy step.

4. Mac backup sync (only if the folder exists and is not the current repo)
   - Check with `test -d "/Users/ew3adam/fishing-app"`.
   - Run `git -C <folder> fetch origin`.
   - If clean: `git -C <folder> pull --ff-only`.
   - If it has local changes: do NOT touch it. Report it.

5. T7 backup sync
   - Check with `test -d "/Volumes/T7 Shield/Clients/RFC/Fishing-App/fishing-app"`.
   - If the folder is missing, say "T7 not connected, skipped". This is not an error.
   - If it exists: same rules as step 4 (fetch, then pull --ff-only only if clean).

6. FTP (only if it exists)
   - If tools/ftp/ftp_config.json exists, run `python3 tools/ftp/ftp_deploy.py --from-state`.
   - If not, say "No FTP for this project, skipped".

7. Verify
   - Run `git rev-parse --short HEAD` in each location that was synced.
   - Run `git rev-parse --short origin/main` in the repo.
   - All hashes must match. If any do not match, say which one is behind.

## Report to Adam (short)

- Commit hash and message (or "nothing to commit")
- Push result
- Mac copy: synced, skipped, or blocked
- T7 drive: synced, not connected, or blocked
- FTP: uploaded count, or skipped
- Verify: all hashes match, or which one differs
- Any failures
