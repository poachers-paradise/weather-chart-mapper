import React, { useMemo } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, ChartDataLabels);

function cToF(c) {
  return c == null ? null : (c * 9 / 5) + 32;
}

function hPaToInHg(h) {
  return h == null ? null : h * 0.029529983071445;
}

// helper: partition by day index from start
function partitionByDay(times) {
  if (!times || times.length === 0) return [];
  const start = new Date(times[0]);
  // normalize to UTC midnight of start
  const startUtcMid = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const groups = Array.from({ length: 10 }, () => ({ labels: [], temp: [], pressure: [], times: [] }));
  times.forEach((t, i) => {
    const dt = new Date(t);
    const dayIndex = Math.floor((Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) - startUtcMid) / (24 * 3600 * 1000));
    if (dayIndex >= 0 && dayIndex < 10) {
      groups[dayIndex].labels.push(dt);
      groups[dayIndex].times.push(dt);
    }
  });
  return groups;
}

export default function ChartPanel({ openMeteoData, nwsObservations, loading, fetchError, onRetry }) {
  const grouped = useMemo(() => {
    if (!openMeteoData || !openMeteoData.hourly) return null;
    const time = openMeteoData.hourly.time || [];
    const tempC = openMeteoData.hourly.temperature_2m || [];
    const pressureHpa = openMeteoData.hourly.surface_pressure || [];

    const times = time.map(t => new Date(t));

    // convert series to Fahrenheit and inHg
    const tempF = tempC.map(c => cToF(c));
    const pressureInHg = pressureHpa.map(p => hPaToInHg(p));

    // Build an array of points (time, tempF, pressureInHg)
    const points = times.map((t, i) => ({ t, tempF: tempF[i], pressureInHg: pressureInHg[i] }));

    // Partition into day indices relative to first timestamp (0..9)
    const start = times[0];
    const startUtcMid = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const days = Array.from({ length: 10 }, () => []);
    points.forEach(pt => {
      const dayIndex = Math.floor((Date.UTC(pt.t.getUTCFullYear(), pt.t.getUTCMonth(), pt.t.getUTCDate()) - startUtcMid) / (24 * 3600 * 1000));
      if (dayIndex >= 0 && dayIndex < 10) days[dayIndex].push(pt);
    });

    // Merge day 0..4 and 5..9 into two groups
    const groupA = days.slice(0, 5).flat();
    const groupB = days.slice(5, 10).flat();

    return { groupA, groupB };
  }, [openMeteoData]);

  const sharedOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true },
      // default datalabels off; we'll enable only for the convergence dataset
      datalabels: { display: false }
    },
    scales: {
      x: { type: 'time', time: { unit: 'hour' } }
    }
  };

  // find convergence points in a group: temp decreasing and pressure increasing and normalized values close
  function findConvergences(group) {
    if (!group || group.length < 3) return [];
    const temps = group.map(p => p.tempF);
    const pres = group.map(p => p.pressureInHg);
    const minVal = Math.min(...temps.filter(v => v != null), ...pres.filter(v => v != null));
    const maxVal = Math.max(...temps.filter(v => v != null), ...pres.filter(v => v != null));
    const range = maxVal - minVal || 1;
    const tNorm = temps.map(v => (v == null ? null : (v - minVal) / range));
    const pNorm = pres.map(v => (v == null ? null : (v - minVal) / range));

    const conv = [];
    for (let i = 1; i < group.length; i++) {
      const prevT = temps[i - 1], curT = temps[i];
      const prevP = pres[i - 1], curP = pres[i];
      if (prevT == null || curT == null || prevP == null || curP == null) continue;
      const tDown = curT < prevT;
      const pUp = curP > prevP;
      if (tDown && pUp) {
        const d = Math.abs((tNorm[i] || 0) - (pNorm[i] || 0));
        // threshold: relatively close when normalized difference < 0.035 (tunable)
        if (d < 0.035) {
          conv.push({ index: i, point: group[i] });
        }
      }
    }
    return conv;
  }

  function buildDataForGroup(group) {
    if (!group || group.length === 0) return null;
    const labels = group.map(p => p.t);
    const temps = group.map(p => p.tempF);
    const pres = group.map(p => p.pressureInHg);

    const convergences = findConvergences(group);
    const scatterPoints = convergences.map(c => ({ x: c.point.t, y: c.point.tempF, meta: c.point }));

    const data = {
      labels,
      datasets: [
        {
          label: 'Temperature (°F)',
          data: temps.map((y, i) => ({ x: labels[i], y })),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.08)',
          yAxisID: 'y',
          tension: 0.2
        },
        {
          label: 'Pressure (inHg)',
          data: pres.map((y, i) => ({ x: labels[i], y })),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.06)',
          yAxisID: 'y1',
          tension: 0.2
        },
        // scatter for convergence labels
        {
          type: 'scatter',
          label: 'Convergence',
          data: scatterPoints,
          backgroundColor: '#9333ea',
          borderColor: '#9333ea',
          pointRadius: 4,
          yAxisID: 'y',
          // enable datalabels for this dataset
          datalabels: {
            display: true,
            align: 'top',
            anchor: 'end',
            formatter: function(value, ctx) {
              const v = value && value.y != null ? value.y : null;
              const presVal = value && value.meta ? value.meta.pressureInHg : null;
              if (v == null || presVal == null) return '';
              return `${Math.round(v)}°F / ${presVal.toFixed(2)} inHg`;
            },
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: 4,
            borderRadius: 4,
            font: { size: 10 }
          }
        }
      ]
    };

    return { data, convergences };
  }

  const groupAData = grouped ? buildDataForGroup(grouped.groupA) : null;
  const groupBData = grouped ? buildDataForGroup(grouped.groupB) : null;

  return (
    <div className="chart-container">
      <h3>Forecast</h3>
      {loading && <div>Loading data…</div>}
      {fetchError && !loading && (
        <div style={{ color: '#b91c1c' }}>
          <div>Failed to load forecast: {String(fetchError)}</div>
          <button onClick={onRetry} style={{ marginTop: 8 }}>Retry</button>
        </div>
      )}
      {!grouped && !loading && !fetchError && <div>No data available</div>}

      {groupAData && (
        <div>
          <h4>Days 1–5 — Temperature & Pressure (overlay)</h4>
          <Line
            data={groupAData.data}
            options={{
              ...sharedOptions,
              plugins: { ...sharedOptions.plugins, legend: { display: true } },
              scales: {
                x: sharedOptions.scales.x,
                y: { type: 'linear', position: 'left', title: { display: true, text: '°F' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'inHg' }, grid: { drawOnChartArea: false } }
              }
            }}
          />
        </div>
      )}

      {groupBData && (
        <div>
          <h4>Days 6–10 — Temperature & Pressure (overlay)</h4>
          <Line
            data={groupBData.data}
            options={{
              ...sharedOptions,
              plugins: { ...sharedOptions.plugins, legend: { display: true } },
              scales: {
                x: sharedOptions.scales.x,
                y: { type: 'linear', position: 'left', title: { display: true, text: '°F' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'inHg' }, grid: { drawOnChartArea: false } }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
