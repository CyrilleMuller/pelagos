# Requesting changes to the website

This guide is for Pascaline and the site maintainer. You do not need to know how to code.

## Three ways to ask for a change

1. **Request portal.** Open `/request/` on the site
   (https://cyrillemuller.github.io/pelagos/request/). Describe what you want changed, where it is and
   how urgent it is. You can attach a screenshot or document.
2. **Suggest-edit mode.** Add `?suggest` to the address of any page, for example
   https://cyrillemuller.github.io/pelagos/?suggest. Click the text you want changed and type
   your suggestion.
3. **GitHub issue.** Go to the repository's *Issues* tab, choose **New issue**, then pick the
   **Change request** form. The form asks for the type of change, the area of the site, the current
   text, the change you want and the priority. You can attach a file.

All three create a GitHub issue labelled `change-request`.

## What happens next

1. Claude reads the request and drafts the change as a *pull request* (a proposed edit). The issue gets
   the `in-progress` label.
2. Claude comments on the issue with a short summary of the change and a link to the proposal.
   If something is unclear, Claude asks a question in the issue instead. Reply there.
3. The maintainer reviews the proposal and merges it, or asks for adjustments.
4. The live site updates automatically about a minute after the merge.

Claude only uses facts from `docs/profile-facts.md`. To add a new client, credential, number or
date, include it in your request so it can be recorded.

## Editing directly

For quick text edits you can use the in-browser editor at `/admin/`
(https://cyrillemuller.github.io/pelagos/admin/). Sign in with the access token the maintainer gave
you. Keep the token private. Your edits are saved to the repository and the site redeploys in about a
minute.

## One-time setup (maintainer)

Automatic drafting needs two things. Until both are set up, requests are still recorded as issues,
but the workflow skips the drafting step with a notice and does not fail.

1. **Install the Claude GitHub app.** Open https://github.com/apps/claude, choose **Install**, and grant
   it access to `cyrillemuller/pelagos`.
2. **Add the API key secret.** Create a key at https://console.anthropic.com. Then in the repository go to
   **Settings → Secrets and variables → Actions → New repository secret**. Name it
   `ANTHROPIC_API_KEY` and paste the key.

The workflows that use them are:

- `.github/workflows/claude-change-request.yml` drafts a PR for each `change-request` issue.
- `.github/workflows/claude.yml` replies when someone writes `@claude` in an issue, a PR comment or a
  review, for example "@claude please shorten this paragraph".

Agent rules for the repository are in `CLAUDE.md`.
