# Site admin (`/admin/`)

A browser-only editor for the Pelagos site. It runs entirely in your browser and saves changes as
commits to this GitHub repository via the GitHub REST API — there is no server. Live at
`https://cyrillemuller.github.io/pelagos/admin/` (not indexed: `noindex` meta).

## First time
1. Create a **fine-grained personal access token**: GitHub → Settings → Developer settings →
   Fine-grained tokens → *Generate new token*. Repository access: only `pelagos`. Permissions:
   **Contents**, **Pull requests**, **Issues**: *Read and write* (optional: **Actions**: *Read* to see deploy status).
2. Open `/admin/`, keep owner `cyrillemuller` / repo `pelagos` / branch `main`, paste the token, **Connect**.
   The token stays in this browser's localStorage only. Use **Forget saved token** / **Log out** on shared machines.

## What you can do
- **Sections** — reorder (drag, ↑/↓ buttons, or Alt+↑/↓), show/hide, edit, duplicate, delete, or add a new
  section from a template (text + image, cards grid, call-to-action band, testimonials, FAQ). Order and
  visibility are stored in `content/site.json`; each section is an HTML file in `src/sections/`.
- **Editor** — *Visual*: click any text on the rendered section and type; click an image to change its
  path/alt text. *Code*: edit the raw HTML. **Save to pending** (Ctrl/Cmd+S) queues the change.
  *Preview this section* opens it standalone with the site's styles.
- **Site settings** — contact details and feature switches (`content/site.json`).
- **Other pages & translations** — CV, speaker kit, FR/ES/DE pages, resources (code editor).

## Publishing
Changes collect in **Pending changes** until you click **Publish…**, which writes them all in one commit
(Git Data API):
- **Publish now** commits to `main`; GitHub Actions rebuilds the site in about a minute (status shown at the top).
- **Propose changes** creates a branch `admin/<timestamp>` and opens a pull request for review.

If someone else changed the same file in the meantime, publishing stops with a conflict message —
discard that change, reload and redo it. Testimonials must be real, attributed quotes (see `docs/profile-facts.md`).
