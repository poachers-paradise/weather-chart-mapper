import axios from "axios";

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Fetch Open-Meteo archive hourly data for given lat/lon and date range.
 * start_date and end_date must be in YYYY-MM-DD format.
 * Returns the hourly object (time[], temperature_2m[], surface_pressure[])
 */
export async function fetchOpenMeteoArchive(lat, lon, start_date, end_date, opts = {}) {
  // Adds timeout and retry logic for more resilient fetching.
  // opts: { attempts: number, timeoutMs: number }
  const attempts = opts.attempts ?? 2;
  const timeoutMs = opts.timeoutMs ?? 8000;

  // Helper to choose endpoint based on whether end_date is today or in future
  const todayStr = new Date().toISOString().slice(0, 10);
  const useForecast = end_date >= todayStr;

  // We'll attempt up to `attempts` times. On retries we reduce the end_date window
  // to keep payloads smaller (first attempt requests the full range, next attempts request fewer days).
  let lastErr = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // compute adjusted end_date for retry attempts (reduce to 5 days on second attempt)
      let adjEnd = end_date;
      if (attempt > 1) {
        const s = new Date(start_date + 'T00:00:00Z');
        const adj = new Date(s);
        adj.setDate(s.getDate() + 4); // 5-day window on retries
        adjEnd = adj.toISOString().slice(0, 10);
      }

      const params = {
        latitude: lat,
        longitude: lon,
        start_date,
        end_date: adjEnd,
        hourly: "temperature_2m,surface_pressure",
        timezone: "UTC"
      };

      const url = useForecast ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
      const res = await axios.get(url, { params, timeout: timeoutMs });
      return res.data;
    } catch (err) {
      lastErr = err;
      // small exponential backoff before retrying
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }

  // All attempts failed
  throw lastErr;
}
