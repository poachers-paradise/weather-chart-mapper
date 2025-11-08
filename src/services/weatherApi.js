import axios from "axios";

/**
 * Fetch Open-Meteo archive hourly data for given lat/lon and date range.
 * start_date and end_date must be in YYYY-MM-DD format.
 * Returns the hourly object (time[], temperature_2m[], surface_pressure[])
 */
export async function fetchOpenMeteoArchive(lat, lon, start_date, end_date) {
  // If requested end_date is in the future (or today), use the forecast endpoint
  // which can return future hourly forecasts; otherwise use the archive endpoint.
  const todayStr = new Date().toISOString().slice(0, 10);
  const useForecast = end_date >= todayStr;

  if (useForecast) {
    const url = "https://api.open-meteo.com/v1/forecast";
    const params = {
      latitude: lat,
      longitude: lon,
      start_date,
      end_date,
      hourly: "temperature_2m,surface_pressure",
      timezone: "UTC"
    };
    const res = await axios.get(url, { params });
    return res.data;
  } else {
    const url = "https://archive-api.open-meteo.com/v1/archive";
    const params = {
      latitude: lat,
      longitude: lon,
      start_date,
      end_date,
      hourly: "temperature_2m,surface_pressure",
      timezone: "UTC"
    };
    const res = await axios.get(url, { params });
    return res.data;
  }
}
