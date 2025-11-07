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
