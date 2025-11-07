import axios from "axios";

/**
 * Uses NWS /points/{lat},{lon} to discover observationStations, then fetches observations.
 *
 * Returns { stationId, observations: [...] } or throws.
 */
export async function fetchNwsObservations(lat, lon) {
  const base = `https://api.weather.gov/points/${lat},${lon}`;
  const p = await axios.get(base, { headers: { "User-Agent": "weather-chart-mapper (example)" } });
  const stationsUrl = p.data.properties.observationStations;
  const stationsRes = await axios.get(stationsUrl);
  const stations = stationsRes.data.features || [];
  if (!stations.length) return { stationId: null, observations: [] };
  const stationId = stations[0].properties.stationIdentifier;
  const observationsUrl = `https://api.weather.gov/stations/${stationId}/observations`;
  const obsRes = await axios.get(observationsUrl);
  return { stationId, observations: obsRes.data.features || [] };
}
