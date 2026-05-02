# Code Refactoring Policy: Eliminating Bloat, Duplication, and Dead Code

Last updated: 2026-05-02

## Why this exists

Over time, codebases naturally accumulate:

- Duplication, which makes bugs harder to fix consistently.
- Dead code, which confuses developers and creates false assumptions.
- Bloat, which makes future changes slower and harder to review.

This policy keeps the codebase healthy, maintainable, and fast to ship.

## When to apply this

- In any PR that touches existing code.
- During dedicated refactoring sessions.
- When duplication, dead code, or unnecessary complexity is noticed during normal work.

## Core rule

If you touch a file, leave it cleaner than you found it.

## What this means

| Problem | Action |
| --- | --- |
| Duplicate logic in two or more places | Extract it to a shared function, class, or module. |
| Unused function, variable, import, or file | Delete it immediately. |
| Commented-out code blocks | Delete them. Git history keeps the old code. |
| Code behind permanently enabled feature flags | Remove the flag and keep only the active branch. |
| Overly complex or verbose code | Simplify it without changing behavior. |

## What is not required

- Massive rewrites of working architecture.
- Refactoring based only on style preference.
- Changes outside the area of work unless they are minimal and obvious.
- Performance optimization unless the bloat directly hurts performance and the fix is trivial.

## Safety rules

1. No functional changes: refactoring must not alter observable behavior.
2. Tests must pass: existing tests are the safety net.
3. No mixing: do not combine refactoring with feature work or bug fixes unless the change is trivial.
4. Small PRs: each refactoring PR should be reviewable and mergeable independently.

## Definition of done

- No duplicate logic remains in the affected area.
- No dead or commented code remains.
- Existing tests pass with no new failures.
- Code coverage does not decrease.
- The PR description clearly states what was removed or consolidated and why.

## Refactoring checklist

Use this checklist in any PR that removes bloat, duplication, or dead code:

- [ ] I removed all duplicated logic I encountered in the affected area.
- [ ] I deleted unused functions, variables, imports, or entire files.
- [ ] I deleted commented-out code blocks.
- [ ] I removed code behind permanently enabled feature flags.
- [ ] Existing tests still pass.
- [ ] No new test failures were introduced.
- [ ] Code coverage did not decrease.
- [ ] The PR describes what was removed or consolidated and why.
- [ ] This PR does not mix refactoring with feature work or bug fixes unless the change is trivial.
