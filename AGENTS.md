# AGENTS.md

## Contribution Rules

Follow these rules for every feature, bug fix, refactor, or other standalone change.

### Branches

- **Never work directly on `main`.**
- Create and use a separate branch for every feature, bug fix, or other standalone change.
- Keep each branch focused on a single feature or change.
- Before creating a branch, ensure you are starting from the appropriate up-to-date base branch.
- Use descriptive branch names, such as:
  - `feat/user-authentication`
  - `fix/login-validation`
  - `refactor/proposal-rendering`
  - `docs/update-setup-guide`

### Commits

- Commit whenever a standalone change is complete.
- Use clear, descriptive commit messages that explain what changed.
- Add an `Assisted-by: <model name>` trailer to every commit, using the name of the model that assisted with the change.
- Keep commits focused. Do not combine unrelated changes into a single commit.
- Review your changes before committing to ensure no unrelated files or changes are included.
- Never commit directly to `main`.

### Moving to the Next Feature

When a feature or standalone change is complete:

1. Review and test the changes as appropriate.
2. Commit the completed changes using a clear, descriptive commit message.
3. Push the feature branch to the remote repository.
4. Open a pull request to merge the feature branch into `main`.
5. Do not add new features to the completed feature's branch.
6. Once the pull request is open, create a new branch from the appropriate up-to-date base for the next feature.

Do not start the next feature on the previous feature's branch, even if its pull request has not yet been merged. Use the latest appropriate base available, and avoid including unrelated or unfinished changes in a pull request.

### General Workflow

For every new task:

1. Check the current Git branch and working tree before making changes.
2. If currently on `main`, create a new feature branch before editing any files.
3. If on a branch for a previously completed feature, create a new branch for the new task.
4. Make only the changes required for the current task.
5. Run relevant tests, linting, type checks, or builds when available.
6. Review the final diff for unintended changes.
7. Commit the completed standalone change.
8. Push the branch and open a pull request into `main`.

### Important Restrictions

- Never switch to `main` to make code changes.
- Never reuse a completed feature branch for unrelated work.
- Never combine multiple unrelated features into one branch or commit.
- Never overwrite, discard, or revert existing user changes without permission.
- If the working tree contains uncommitted changes, preserve them. Do not assume they belong to the current task.
- If a required Git operation cannot be completed, explain what remains to be done instead of claiming it succeeded.
- If you cannot push a branch or open a pull request, provide the necessary next steps.

**Default rule:** One standalone change per branch, focused commits, and one pull request into `main` for each completed change.
