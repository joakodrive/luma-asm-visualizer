# LUMA Asset Strategy & Management — Initiative Portfolio Visualizer

An interactive website that visualizes the Asset Strategy & Management initiative portfolio:
a clickable network graph (Asset Management → Categories → Asset classes → Initiatives),
a dashboard, and a searchable table. **Every view is built automatically from one CSV file** —
you never edit code to change the data.

---

## What's in this folder

```
luma-asm-visualizer/
├── index.html              ← the web page (don't usually need to touch)
├── css/styles.css          ← colors & styling (edit brand colors here)
├── js/app.js               ← the logic (don't usually need to touch)
├── data/initiatives.csv    ← YOUR DATA — this is the only file you update regularly
└── README.md               ← this file
```

---

## How to put it online (first time — no coding needed)

You do this once. After that, updating data is just replacing one file.

### Step 1 — Make a free GitHub account
Go to https://github.com and sign up (skip if you already have one).

### Step 2 — Create a repository
1. Top-right **+** → **New repository**.
2. Repository name: `luma-asm-visualizer`
3. Choose **Private** (only you/invited people can see the code).
4. Click **Create repository**.

### Step 3 — Upload these files
1. On the new repo page, click **uploading an existing file** (or **Add file ▸ Upload files**).
2. Open the unzipped `luma-asm-visualizer` folder on your computer.
3. Select the **contents** — `index.html`, and the `css`, `js`, `data` folders — and drag them
   into the upload box. **Important:** drag the *contents*, NOT the outer `luma-asm-visualizer`
   folder, so that `index.html` lands at the top level of the repo (not inside a sub-folder).
4. Scroll down, click **Commit changes**.

### Step 4 — Turn on the website (GitHub Pages)
1. In the repo, click **Settings** (top tabs).
2. Left sidebar → **Pages**.
3. Under **Source**, pick **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)** → **Save**.
5. Wait ~1 minute, refresh. GitHub shows a link like
   `https://YOUR-USERNAME.github.io/luma-asm-visualizer/` → that's your live site.

> ⚠️ On the free GitHub plan, a Pages site is **publicly reachable** even if the repo is private.
> To make the *site itself* private/login-gated, see "Making it private" below.

---

## How to UPDATE the data later (the only routine task)

1. In Excel, open your initiatives workbook.
2. **File ▸ Save As ▸ CSV UTF-8 (Comma delimited) (\*.csv)** — name it `initiatives.csv`.
3. In GitHub: open the repo → `data` folder → click `initiatives.csv` → **Upload files** (or the
   pencil ✏️ to edit) → drop in your new `initiatives.csv` (same name) → **Commit changes**.
4. Wait ~1 minute. The site updates itself.

**The header row must stay exactly:**
`Category, Name, Assets Involved, Assets Involved 2, Description, Owner, Collaborator, Person in Charge`

- Leave **Owner** blank and that initiative shows as **Unassigned** (flagged red — a governance gap).
- Add new teams, categories, assets, or people freely — they appear automatically, new teams get
  their own color. No code changes ever needed.
- Commas inside descriptions are fine (Excel auto-quotes them; the site reads them correctly).
- Save as **CSV UTF-8** so accents / ñ survive.

---

## Editing the brand colors

Open `css/styles.css`. At the very top, change these two lines to LUMA's official hex values:
```
--luma-orange:#F58220;
--luma-navy:#0E2A47;
```
(These are close approximations. Sample the exact colors from the official LUMA logo with any
color-picker tool for a perfect match.)

---

## How to use it (and present it to the EVP)

- **Network tab:** click a **category** to collapse/expand it, an **asset** (e.g. Transformers)
  to spotlight every initiative that touches it, an **initiative** for its full detail card,
  a **team chip** to see what it owns vs. collaborates on and who it interconnects with, and a
  **person chip** to filter to everything they manage. Drag, scroll to zoom.
- **Dashboard tab:** counts by category / team / person, an ownership matrix, team interconnections,
  and a red callout of unassigned-owner initiatives.
- **Table tab:** sortable, filterable list of everything; search box filters as you type.
- **Top search box:** finds initiatives, assets, teams, and people across the whole portfolio.

**Presentation flow:** press **F11** for fullscreen, then click-through:
Asset Management (center) → **Substation** → **Transformers** → open **Transformer Replacement
Project** → click the **Asset Management** chip to show its portfolio → switch to **Dashboard**
and point at the unassigned-owner callout.

---

## Making it private (login required)

GitHub Pages free can't gate the site behind a login. Easiest free option that works today:

**Cloudflare Pages + Cloudflare Access** (free for up to 50 users):
1. Create a free Cloudflare account → **Workers & Pages ▸ Create ▸ Pages ▸ Connect to Git** →
   pick this repo. Build command: `exit 0`. Output directory: `/`. Deploy.
2. **Zero Trust ▸ Access ▸ Applications ▸ Add a self-hosted application** → set it to your Pages
   domain → add an **Allow** policy listing the email addresses (or `@lumapr.com` domain) that may
   enter → choose **One-time PIN** as the login method.
   Now only those people get in (they receive an email code); the public can't see it.

Later, when LUMA IT cooperates, you can switch the login to **Microsoft Entra ID (Office 365 SSO)**
either inside Cloudflare Access or by moving to **Azure Static Web Apps** (Microsoft-native, free
tier with built-in Entra login).

---

## Future: auto-sync from SharePoint (no manual uploads)

A **Power Automate** flow can push updates for you:
trigger on the SharePoint file/list changing → build the CSV → send it to GitHub via the REST API
(`PUT /repos/{owner}/{repo}/contents/data/initiatives.csv`, with the file content Base64-encoded and
the existing file's `sha`). The site then auto-updates. Set this up once IT grants you a GitHub
token; until then, the manual Save-As-CSV + upload takes about a minute.

---

## Troubleshooting

- **Blank page / "Could not load initiatives.csv":** you opened `index.html` directly from your
  computer (a `file://...` address). Browsers block that. Use the GitHub Pages link instead, or to
  preview locally run `python -m http.server` inside the folder and open `http://localhost:8000`.
- **A column looks shifted:** the CSV header row was changed or a stray comma broke a row. Re-export
  from Excel as **CSV UTF-8** and keep the 8 headers exactly as listed above.
- **My new team has no color:** it does — colors are auto-assigned from a palette and cycle if there
  are more than 16 teams. Reload the page after committing.

## Tech (for reference)
Plain HTML/CSS/JavaScript, no build step. Loads two libraries from a CDN at runtime:
**D3.js v7** (network graph + charts) and **PapaParse 5** (CSV reading). Runs on any static host.
