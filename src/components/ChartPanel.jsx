import React, { useMemo, useState, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, ScatterController, Title, Tooltip, Legend, TimeScale } from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, ScatterController, Title, Tooltip, Legend, TimeScale, ChartDataLabels);

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
  const [tooltipData, setTooltipData] = useState(null);
  const chartRefA = useRef(null);
  const chartRefB = useRef(null);

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

    // Calculate date ranges for titles
    const groupAStart = groupA.length > 0 ? groupA[0].t : null;
    const groupAEnd = groupA.length > 0 ? groupA[groupA.length - 1].t : null;
    const groupBStart = groupB.length > 0 ? groupB[0].t : null;
    const groupBEnd = groupB.length > 0 ? groupB[groupB.length - 1].t : null;

    const formatDate = (date) => date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    return { 
      groupA, 
      groupB,
      groupATitle: `${formatDate(groupAStart)} - ${formatDate(groupAEnd)}`,
      groupBTitle: `${formatDate(groupBStart)} - ${formatDate(groupBEnd)}`
    };
  }, [openMeteoData]);

  // Custom external tooltip handler
  const externalTooltipHandler = (context) => {
    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0) {
      setTooltipData(null);
      return;
    }
    
    if (tooltipModel.body) {
      const dataPoints = tooltipModel.dataPoints || [];
      const title = tooltipModel.title || [];
      const lines = [];
      
      dataPoints.forEach((point, i) => {
        const label = point.dataset.label || '';
        const value = point.formattedValue || '';
        lines.push({ label, value });
      });
      
      setTooltipData({
        title: title[0] || '',
        lines
      });
    }
  };

  const sharedOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler
      },
      datalabels: { display: false }
    },
    scales: {
      x: { 
        type: 'time', 
        time: { 
          unit: 'hour',
          displayFormats: {
            hour: 'HH:mm'
          },
          tooltipFormat: 'MMM dd, yyyy HH:mm'
        },
        ticks: {
          callback: function(value, index, ticks) {
            const date = new Date(value);
            const hour = date.getHours();
            // Show date label at midnight (00:00) or first tick
            if (hour === 0 || index === 0) {
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          },
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  // find convergence points in a group: ONLY when pressure is rising AND temperature is falling
  function findConvergences(group) {
    if (!group || group.length < 3) return [];
    const temps = group.map(p => p.tempF);
    const pres = group.map(p => p.pressureInHg);

    const conv = [];
    for (let i = 1; i < group.length; i++) {
      const prevT = temps[i - 1], curT = temps[i];
      const prevP = pres[i - 1], curP = pres[i];
      if (prevT == null || curT == null || prevP == null || curP == null) continue;
      
      // ONLY highlight when pressure is rising AND temperature is falling
      const temperatureFalling = curT < prevT;
      const pressureRising = curP > prevP;
      
      if (temperatureFalling && pressureRising) {
        conv.push({ index: i, point: group[i] });
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
        // scatter for convergence points - red X markers
        {
          type: 'scatter',
          label: 'Convergence',
          data: scatterPoints,
          backgroundColor: '#dc2626',
          borderColor: '#dc2626',
          pointRadius: 10,
          pointStyle: 'crossRot',
          pointBorderWidth: 3,
          yAxisID: 'y'
        }
      ]
    };

    return { data, convergences };
  }

  const groupAData = grouped ? buildDataForGroup(grouped.groupA) : null;
  const groupBData = grouped ? buildDataForGroup(grouped.groupB) : null;

  return (
    <div className="chart-container">
      {loading && <div>Loading data…</div>}
      {fetchError && !loading && (
        <div style={{ color: '#b91c1c' }}>
          <div>Failed to load forecast: {String(fetchError)}</div>
          <button onClick={onRetry} style={{ marginTop: 8 }}>Retry</button>
        </div>
      )}
      {!grouped && !loading && !fetchError && <div>No data available</div>}

      {groupAData && grouped && (
        <div>
          <h4>{grouped.groupATitle} — Temperature & Pressure (overlay)</h4>
          <Line
            ref={chartRefA}
            data={groupAData.data}
            options={{
              ...sharedOptions,
              plugins: { ...sharedOptions.plugins, legend: { display: true } },
              scales: {
                x: sharedOptions.scales.x,
                y: { type: 'linear', position: 'left', title: { display: true, text: '°F' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'inHg' }, min: 28, max: 32, grid: { drawOnChartArea: false } }
              }
            }}
          />
        </div>
      )}

      {groupBData && grouped && (
        <div>
          <h4>{grouped.groupBTitle} — Temperature & Pressure (overlay)</h4>
          <Line
            ref={chartRefB}
            data={groupBData.data}
            options={{
              ...sharedOptions,
              plugins: { ...sharedOptions.plugins, legend: { display: true } },
              scales: {
                x: sharedOptions.scales.x,
                y: { type: 'linear', position: 'left', title: { display: true, text: '°F' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'inHg' }, min: 28, max: 32, grid: { drawOnChartArea: false } }
              }
            }}
          />
        </div>
      )}

      {tooltipData && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
            {tooltipData.title}
          </div>
          {tooltipData.lines.map((line, idx) => (
            <div key={idx} style={{ color: '#6b7280', marginBottom: '4px' }}>
              <span style={{ fontWeight: '600' }}>{line.label}:</span> {line.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
