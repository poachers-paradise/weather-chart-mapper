// Thermal feature calculator and heuristic score
// Translated from Python thermal scoring algorithm

// Constants
const g = 9.80665;
const R_over_cp = 0.286;
const p0 = 100000.0;
const kappa = 0.4;

export function potentialTemperature(T, p) {
  // T in K, p in Pa
  return T * Math.pow(p0 / p, R_over_cp);
}

export function mixingRatioFromRH(T, p, rh) {
  // Approximate mixing ratio (kg/kg) from T(K), p(Pa), rh (0-1) using Tetens formula
  const T_C = T - 273.15;
  const es = 6.112 * Math.exp((17.67 * T_C) / (T_C + 243.5)) * 100.0; // Pa
  const e = rh * es;
  const eps = 0.622;
  const r = eps * e / (p - e + 1e-12);
  return r;
}

export function virtualTemperature(T, r) {
  return T * (1.0 + 0.61 * r);
}

export function virtualPotentialTemperature(T, p, r) {
  const theta = potentialTemperature(T, p);
  return theta * (1.0 + 0.61 * r);
}

export function estimateB0FromInsolation(insolation, albedo = 0.2, theta_v0 = 300.0, sensible_frac = 0.5) {
  // Very-rough proxy: convert solar W/m2 to kinematic sensible heat flux
  // sensible_frac is fraction of net radiation going to sensible heat (depends on surface)
  const H = insolation * (1 - albedo) * sensible_frac;
  const rho = 1.225;
  const cp = 1004.0;
  const wtheta = H / (rho * cp + 1e-12);
  const B0 = g / (theta_v0 + 1e-12) * wtheta;
  return B0;
}

export function convectiveVelocityScale(B0, zi) {
  if (!zi || zi <= 0 || B0 <= 0) {
    return 0.0;
  }
  return Math.pow(B0 * zi, 1.0 / 3.0);
}

export function gradientRichardson(theta_profile, u_profile, v_profile, z_profile) {
  // Quick gradient Richardson number between surface and first level
  // Profiles are arrays with surface at index 0
  if (theta_profile.length < 2) {
    return 1e6;
  }
  const dz = z_profile[1] - z_profile[0];
  const dtheta = theta_profile[1] - theta_profile[0];
  const du = u_profile[1] - u_profile[0];
  const dv = v_profile[1] - v_profile[0];
  const dU = Math.hypot(du, dv);
  const denom = Math.pow(dU / (dz + 1e-12), 2);
  const Ri = (g / (theta_profile[0] + 1e-12)) * (dtheta / (dz + 1e-12)) / (denom + 1e-12);
  return Ri;
}

export function windFavorabilityScore(u, center = 4.0, sigma = 2.0) {
  // Gaussian-like favorability for moderate wind speeds (m/s)
  return Math.exp(-0.5 * Math.pow((u - center) / sigma, 2));
}

export function slopeAspectFactor(aspect_deg, wind_dir_deg, slope_deg, sun_alignment = 1.0) {
  // Simple upslope alignment factor [0..1]
  const ang_diff = (wind_dir_deg - aspect_deg) * Math.PI / 180;
  const align = Math.max(0.0, Math.cos(ang_diff));
  return align * (Math.tanh(slope_deg / 10.0) * sun_alignment);
}

export function thermalScoreSinglePoint({
  T_surface,
  p_surface,
  rh_surface,
  wind_speed,
  wind_dir,
  T_profile,
  p_profile,
  z_profile,
  u_profile,
  v_profile,
  slope_deg = 0.0,
  aspect_deg = 0.0,
  insolation = 500.0,
  zi = 1000.0
}) {
  /**
   * Compute a heuristic thermal score for a single point.
   * Returns object: { score, wstar, B0, Ri, components }
   */
  const r = mixingRatioFromRH(T_surface, p_surface, rh_surface);
  const theta_v0 = virtualPotentialTemperature(T_surface, p_surface, r);
  const B0 = estimateB0FromInsolation(insolation, 0.2, theta_v0);
  const wstar = convectiveVelocityScale(B0, zi);
  
  const theta_profile = T_profile.map((T, i) => potentialTemperature(T, p_profile[i]));
  const Ri = gradientRichardson(theta_profile, u_profile, v_profile, z_profile);

  const s_w = Math.min(1.0, wstar / 2.0);
  const s_Ri = Ri <= 0.0 ? 1.0 : Math.max(0.0, 1.0 - Ri / 0.5);
  const s_wind = windFavorabilityScore(wind_speed);
  const s_slope = slopeAspectFactor(aspect_deg, wind_dir, slope_deg);

  const S = 0.45 * s_w + 0.25 * s_Ri + 0.2 * s_wind + 0.1 * s_slope;
  
  return {
    score: Math.max(0.0, Math.min(1.0, S)),
    wstar: wstar,
    B0: B0,
    Ri: Ri,
    components: {
      w: s_w,
      Ri: s_Ri,
      wind: s_wind,
      slope: s_slope
    }
  };
}

/**
 * Calculate thermal potential for a time series of forecast data
 * Returns array of thermal scores for each time point
 */
export function calculateThermalTimeSeries(forecastData, options = {}) {
  const {
    slope_deg = 0.0,
    aspect_deg = 0.0,
    zi = 1000.0
  } = options;

  if (!forecastData || !forecastData.hourly) {
    return [];
  }

  const hourly = forecastData.hourly;
  const times = hourly.time || [];
  const temps_C = hourly.temperature_2m || [];
  const pressure_hPa = hourly.pressure_msl || hourly.surface_pressure || [];
  const rh = hourly.relative_humidity_2m || [];
  const wind_speed = hourly.wind_speed_10m || [];
  const wind_dir = hourly.wind_direction_10m || [];
  
  // Estimate solar insolation based on time of day and cloud cover
  const cloud_cover = hourly.cloud_cover || [];

  const results = [];
  
  for (let i = 0; i < times.length; i++) {
    // Convert units
    const T_K = temps_C[i] + 273.15;
    const p_Pa = pressure_hPa[i] * 100; // hPa to Pa
    const rh_fraction = (rh[i] || 50) / 100.0;
    const ws = wind_speed[i] || 0;
    const wd = wind_dir[i] || 0;

    // Estimate insolation based on hour and cloud cover
    const date = new Date(times[i]);
    const hour = date.getUTCHours();
    const solarElevation = estimateSolarElevation(hour);
    const cloudFactor = 1.0 - ((cloud_cover[i] || 0) / 100.0) * 0.7;
    const insolation = Math.max(0, 1000 * Math.sin(solarElevation * Math.PI / 180) * cloudFactor);

    // Simple profile (we don't have vertical data, so approximate)
    const T_profile = [T_K, T_K - 2]; // Assume 2K lapse
    const p_profile = [p_Pa, p_Pa * 0.9]; // Rough pressure drop
    const z_profile = [0, 1000]; // Surface to 1km
    const u_profile = [ws * Math.cos(wd * Math.PI / 180), ws * Math.cos(wd * Math.PI / 180) * 0.8];
    const v_profile = [ws * Math.sin(wd * Math.PI / 180), ws * Math.sin(wd * Math.PI / 180) * 0.8];

    const thermal = thermalScoreSinglePoint({
      T_surface: T_K,
      p_surface: p_Pa,
      rh_surface: rh_fraction,
      wind_speed: ws,
      wind_dir: wd,
      T_profile,
      p_profile,
      z_profile,
      u_profile,
      v_profile,
      slope_deg,
      aspect_deg,
      insolation,
      zi
    });

    results.push({
      time: times[i],
      ...thermal,
      insolation,
      hour
    });
  }

  return results;
}

function estimateSolarElevation(hour) {
  // Simple approximation: peak at solar noon (12 UTC ≈ local noon)
  // Returns elevation in degrees (0-90)
  const hourAngle = (hour - 12) * 15; // degrees from noon
  const maxElevation = 60; // depends on latitude/season, simplified
  return Math.max(0, maxElevation * Math.cos(hourAngle * Math.PI / 180));
}
