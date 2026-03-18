---
name: git-pr-workflow
description: "Apply an industry-standard Git and GitHub contribution workflow for repository changes. Use when preparing code for review or release: create a feature branch named feat/short-description, keep commits focused and logically grouped with conventional messages (type(scope): summary), run project verification steps, push the branch, and open a pull request against main without pushing directly to main."
---

# Git PR Workflow

## Follow The Workflow

1. Sync local `main` before starting work.

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

2. Create a feature branch with `feat/<short-description>`.

```bash
git checkout -b feat/<short-description>
```

3. Stage only relevant files and create focused commits.
- Keep each commit logically grouped.
- Use commit messages in `type(scope): summary` format.
- Prefer multiple small commits over one mixed commit.

```bash
git add <files>
git commit -m "feat(routes): restructure admin home navigation"
```

4. Run verification commands required by the repository.
- Run build/tests required by repo policy.
- Include the executed verification steps in the PR body.

5. Push the branch and open a PR to `main`.

```bash
git push -u origin feat/<short-description>
gh pr create --base main --head feat/<short-description>
```

6. Keep updates review-friendly.
- Address feedback with focused follow-up commits.
- Avoid force-pushing unless team policy allows it.

## Enforce Guardrails

- Do not push directly to `main`.
- Do not bundle unrelated changes in the same commit.
- If unrelated local modifications exist, leave them out of the feature commit unless explicitly requested.

## Use The PR Checklist

- Use [references/pr-checklist.md](references/pr-checklist.md) when drafting or reviewing PR content.
