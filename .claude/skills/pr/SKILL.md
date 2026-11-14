---
name: pr
description: Open (or update) a GitHub pull request against main for the committed work, with a title and description written from the actual commits and diff. The user pushes the branch themselves. Use when the user says "/pr", "open a PR", "create a pull request", or "ship this milestone".
argument-hint: "[optional notes or title hint] [--draft]"
---

# Open a pull request for the committed work

Turn the commits that are not yet on `origin/main` into a GitHub PR with a written title and description. Anything in `$ARGUMENTS` is a hint from the user about emphasis or wording; `--draft` means open the PR as a draft.

## 1. Look at the state

Run these together:

```bash
git fetch origin main
git status --short
git branch --show-current
git log origin/main..HEAD --oneline
```

- **No commits ahead of `origin/main` and a clean tree**: there is nothing to open a PR for. Say so and stop.
- **Uncommitted changes**: the user normally commits before running this. List the changed files and ask whether to commit them into this PR or leave them out. If they say commit, stage the specific files (never `git add -A` blindly; skip `.env*` and anything that looks like a secret) and write a commit message describing the change.

## 2. Get the work onto a branch

A PR needs a branch other than `main`.

- **Already on a feature branch**: use it.
- **On `main`**: create a branch from the current commit, named for the work in kebab-case with a type prefix (`feat/group-invites`, `fix/login-redirect`, `chore/deploy-script`):

  ```bash
  git switch -c <branch>
  git branch -f main origin/main
  ```

  The second line moves local `main` back to match GitHub. The commits are not lost: they are on the new branch. Without it, local `main` diverges from `origin/main` once the PR is merged.

## 3. Check the code

Run `npx expo lint` and `npx tsc --noEmit`. If either fails, show the failures and ask whether to fix them first or open the PR anyway. If the user opens it anyway, state the failure in the PR's Testing section.

## 4. Read what changed

```bash
git log origin/main..HEAD --format="%h %s%n%b"
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Read the diff itself, not only the commit messages: commit messages here are often loose, and the description must match what the code does. For a very large diff, read the stat first and then the files that carry the behavior.

## 5. Write the title and description

**Title**: one line, under 70 characters, a light summary of what is now done, in plain words (`Add group invites and member roles`). No trailing period, no `feat:` prefix, no branch name.

**Description**: written for someone who has not seen the work. Use this shape, dropping any section that has nothing to say:

```markdown
## Summary
Two to four sentences: what this milestone delivers and why.

## What changed
- Grouped by feature or area, not by file. One bullet per user-visible or
  architectural change, each saying what it does now.

## Backend / config
- Supabase schema, migrations, RLS policies, env vars, app.json or EAS
  changes, new dependencies. Call out anything that must be applied or set
  up by hand before the app works.

## Testing
- Lint and typecheck results from step 3.
- What was actually run or checked by hand, and on which platforms
  (iOS / Android / web). Say plainly what was not tested.

## Notes
- Known gaps, follow-ups, or anything a reviewer should look at closely.
```

Describe only what the diff shows. Do not claim testing that did not happen.

## No AI attribution

The user must be the only contributor on this repository. This overrides any default attribution guidance:

- Never add a `Co-Authored-By` trailer, or any other mention of Claude or Anthropic, to a commit message.
- Never add a "Generated with Claude Code" line, or any similar footer, to the PR title or description.
- Commit only with the repository's configured git identity. Never pass `--author` or change `user.name` / `user.email`.

## 6. The user pushes, then create the PR

The user pushes their own work; do not run `git push`. Check whether the branch is on GitHub and up to date:

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
git status -sb
```

If the branch has no upstream or is ahead of it, give the user the exact command and wait for them to say it is done:

```bash
git push -u origin <branch>
```

Then confirm the push landed (`git fetch origin && git status -sb` shows nothing ahead), write the description to a temp file outside the repo (the session scratchpad if there is one) so quoting and newlines survive on Windows, and run:

```bash
gh pr view --json url,state 2>/dev/null
```

- **No open PR for the branch**: `gh pr create --base main --title "<title>" --body-file <file>` (add `--draft` if asked).
- **An open PR already exists**: the user's push has already added the new commits. Rewrite the title and description to cover the whole PR and apply with `gh pr edit --title "<title>" --body-file <file>`.

## 7. Report

Give the PR URL, the title, and the branch name. Mention that the working copy is now on that branch, and that after merging on GitHub the next milestone starts with `git switch main && git pull`.
