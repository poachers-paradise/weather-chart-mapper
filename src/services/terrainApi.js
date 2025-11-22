// Terrain/elevation data service for slope and aspect calculations

/**
 * Fetch elevation data from USGS Elevation Point Query Service
 * Returns elevation in meters
 */
export async function getElevation(lat, lon) {
  try {
    const url = `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Meters&wkid=4326`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.value !== null && data.value !== undefined) {
      return parseFloat(data.value);
    }
    return null;
  } catch (error) {
    console.error('Error fetching elevation:', error);
    return null;
  }
}

/**
 * Calculate slope and aspect from elevation data at multiple points
 * Uses a simple 3x3 grid around the center point
 * @param {number} lat - center latitude
 * @param {number} lon - center longitude
 * @param {number} gridSize - distance in meters for sampling points (default 100m)
 * @returns {Promise<{slope_deg: number, aspect_deg: number, elevation: number}>}
 */
export async function getTerrainData(lat, lon, gridSize = 100) {
  // Convert gridSize in meters to approximate lat/lon degrees
  // At equator: 1° latitude ≈ 111km, 1° longitude ≈ 111km * cos(lat)
  const latDelta = gridSize / 111000; // meters to degrees latitude
  const lonDelta = gridSize / (111000 * Math.cos(lat * Math.PI / 180)); // meters to degrees longitude
  
  // Sample 3x3 grid of elevations around the point
  const points = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const sampleLat = lat + (i * latDelta);
      const sampleLon = lon + (j * lonDelta);
      points.push({
        lat: sampleLat,
        lon: sampleLon,
        i: i,
        j: j
      });
    }
  }
  
  // Fetch all elevations (can be done in parallel but USGS prefers sequential)
  const elevations = [];
  for (const point of points) {
    const elev = await getElevation(point.lat, point.lon);
    elevations.push({
      ...point,
      elevation: elev
    });
    // Small delay to be nice to USGS servers
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Get center elevation
  const centerElev = elevations.find(p => p.i === 0 && p.j === 0)?.elevation || 0;
  
  // Calculate slope using gradient method
  // dz/dx and dz/dy from central differences
  const east = elevations.find(p => p.i === 0 && p.j === 1)?.elevation || centerElev;
  const west = elevations.find(p => p.i === 0 && p.j === -1)?.elevation || centerElev;
  const north = elevations.find(p => p.i === 1 && p.j === 0)?.elevation || centerElev;
  const south = elevations.find(p => p.i === -1 && p.j === 0)?.elevation || centerElev;
  
  const dz_dx = (east - west) / (2 * gridSize);
  const dz_dy = (north - south) / (2 * gridSize);
  
  // Slope in degrees
  const slope_rad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
  const slope_deg = slope_rad * 180 / Math.PI;
  
  // Aspect in degrees (0° = North, 90° = East, 180° = South, 270° = West)
  let aspect_deg = Math.atan2(dz_dx, dz_dy) * 180 / Math.PI;
  if (aspect_deg < 0) aspect_deg += 360;
  
  return {
    slope_deg: slope_deg,
    aspect_deg: aspect_deg,
    elevation: centerElev
  };
}

/**
 * Cached version - fetches terrain data and caches it
 */
const terrainCache = new Map();

export async function getTerrainDataCached(lat, lon, gridSize = 100) {
  // Round to 4 decimal places for cache key (~11m precision)
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${gridSize}`;
  
  if (terrainCache.has(key)) {
    return terrainCache.get(key);
  }
  
  const data = await getTerrainData(lat, lon, gridSize);
  terrainCache.set(key, data);
  return data;
}
