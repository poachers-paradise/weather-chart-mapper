# Weather Chart Mapper — MVP

A minimal single-page app (Vite + React) that fetches and visualizes hourly temperature and surface pressure for any location (up to a 10-day historical range) and overlays data on an open-source map.

This branch (`feature/mvp`) contains an initial skeleton imported from Copilot Chat and wired to:
- MapLibre for mapping
- Open-Meteo archive API for hourly historical data
- NWS (weather.gov) helpers for station observations
- Chart.js (via react-chartjs-2) for plotting hourly series

Live demo
- This repository is configured to deploy to GitHub Pages via a GitHub Actions workflow when `main` is updated (see `.github/workflows/deploy-gh-pages.yml`).
- After this PR is merged into `main`, the site will be published at:

  https://poachers-paradise.github.io/weather-chart-mapper/

Quick start (local)

1. Clone the repo and check out the branch you want (or run on `main` after merging):

   ```bash
   git clone https://github.com/poachers-paradise/weather-chart-mapper.git
   cd weather-chart-mapper
   git checkout feature/mvp
   ```

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open the Vite dev URL printed in the terminal (usually http://localhost:5173).

Build for production

```bash
npm run build
# serve the generated `dist/` directory with your static host of choice
```

Deployment notes
- A GitHub Actions workflow is included to build and publish the `dist/` directory to GitHub Pages when `main` receives a push. That means after we merge this PR the action will run and publish the site at the GitHub Pages URL above.
- Alternatively, you can deploy to Vercel or Netlify for preview branches and automatic previews — I can set that up if you prefer.

Project organization
- `index.html` — Vite entry
- `package.json` — dependencies + scripts
- `src/` — React app
  - `src/components` — UI components
  - `src/services` — API helpers (Open-Meteo, NWS)

Next steps & ideas
- Add README sections for environment variables and API limits
- Add tests and basic linting/formatting (ESLint/Prettier)
- Add CI to run tests on PRs
- Improve UX: controls for date range, more map overlays, better chart interactions

License
This project uses the MIT license (see `LICENSE`).
# Weather Chart Mapper — MVP

A minimal single-page app to fetch and visualize hourly temperature and surface pressure for any location (10-day range), overlayed on an open-source map. Includes NOAA/NWS station observations where available, MapLibre map with satellite/topography toggles, and GeoJSON parcel upload.

Quick features
- Search by place name (Nominatim)
- Click map to set location
- Fetch Open‑Meteo hourly temperature & surface pressure (archive API)
- Fetch NOAA/NWS station observations for the point (if available)
- Dual-axis Chart.js chart (temperature + pressure)
- Upload GeoJSON parcels and toggle visibility
- Open-source maps only (MapLibre)

Run locally
1. Install:
   npm install

2. Run dev server:
   npm run dev

3. Open http://localhost:5173

Build for production:
npm run build
npm run serve

How to push these files into GitHub (create branch feature/mvp)
git checkout -b feature/mvp
git add .
git commit -m "feat(mvp): initial weather-chart-mapper scaffold"
git push -u origin feature/mvp

Notes
- Open-Meteo archive API is used for the 10-day hourly data (no API key).
- NOAA/NWS API is used to fetch station observations (where available).
- Respect rate limits for Nominatim (geocoding).
- If you want, I can push these files to the repo once the repository has an initial branch or you authorize me to create it.
