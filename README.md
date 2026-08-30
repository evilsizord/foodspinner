# foodspinner

Basic Next.js single-page app scaffolded for static hosting on GitHub Pages.

## App behavior

- Mobile-first single-page restaurant spinner.
- Load data from a Google Sheet URL or directly from a Sheet ID.
- Optional category filter before spinning.
- Spinner supports up to 15 restaurants at once.

## Environment variable

If you want the app to prefill your specific Google Sheet URL, set this in your local env file:

NEXT_PUBLIC_GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/your-sheet-id/edit?gid=0

Notes:

1. This is a public client-side variable by design.
2. On hosting, set the same variable in your build environment so Next.js can inject it at build time.

## Google Sheet format

Use a sheet with at least 2 rows and these columns (header names are flexible):

| restaurant | category |
| --- | --- |
| Taco Harbor | Mexican |
| Green Bowl | Healthy |

Accepted header names for restaurant: `restaurant`, `restaurants`, `name`, `place`.

Accepted header names for category: `category`, `type`, `cuisine`.

If there is no recognized header, the app falls back to:

- column 1 = restaurant name
- column 2 = category

Google Sheets access requirements:

1. Share the sheet so anyone with the link can view, or publish it to the web.
2. Copy the sheet URL (or just the sheet ID) and paste it into the app.

## Run locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000

## Build for GitHub Pages

Create a production static export:

```bash
npm run build
```

The static site is generated in `out/`.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In GitHub, open Settings -> Pages.
3. Under Build and deployment, set Source to GitHub Actions.
4. Add a workflow at `.github/workflows/deploy.yml` using the official Next.js static export + Pages template, with publish directory `./out`.

The project is already configured for Pages in `next.config.mjs`:

- `output: "export"`
- `trailingSlash: true`
- production `basePath` and `assetPrefix` set to `/foodspinner`

If you rename the repository, update `repoName` in `next.config.mjs` to match the new repository name.