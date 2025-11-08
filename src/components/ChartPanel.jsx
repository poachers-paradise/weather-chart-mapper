import React, { useMemo } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from "chart.js";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

export default function ChartPanel({ openMeteoData, nwsObservations, loading }) {
  const { full, fiveDay } = useMemo(() => {
    if (!openMeteoData || !openMeteoData.hourly) return { full: null, fiveDay: null };
    const time = openMeteoData.hourly.time || [];
    const temp = openMeteoData.hourly.temperature_2m || [];
    const pressure = openMeteoData.hourly.surface_pressure || [];

    // Convert time strings to Date objects
    const times = time.map(t => new Date(t));
    const now = new Date();

    // Full 10-day dataset
    const full = {
      labels: times,
      temp,
      pressure
    };

    // 5-day window starting from now
    const fiveDaysLater = new Date(now);
    fiveDaysLater.setDate(now.getDate() + 5);
    const fiveIndices = times.map((dt, i) => ({ dt, i })).filter(x => x.dt >= now && x.dt < fiveDaysLater).map(x => x.i);

    const fiveDay = {
      labels: fiveIndices.map(i => times[i]),
      temp: fiveIndices.map(i => temp[i]),
      pressure: fiveIndices.map(i => pressure[i])
    };

    return { full, fiveDay };
  }, [openMeteoData]);

  const sharedOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: true } },
    scales: {
      x: { type: 'time', time: { unit: 'hour' } }
    }
  };

  return (
    <div className="chart-container">
      <h3>Forecast</h3>
      {loading && <div>Loading data…</div>}
      {!full && !loading && <div>No data available</div>}

      {fiveDay && (
        <div>
          <h4>Next 5 days — Temperature (stacked)</h4>
          <Line
            data={{ labels: fiveDay.labels, datasets: [{ label: 'Temperature (°C)', data: fiveDay.temp, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true }] }}
            options={{ ...sharedOptions, scales: { ...sharedOptions.scales, y: { title: { display: true, text: '°C' } } } }}
          />

          <h4>Next 5 days — Surface Pressure (stacked)</h4>
          <Line
            data={{ labels: fiveDay.labels, datasets: [{ label: 'Surface pressure (hPa)', data: fiveDay.pressure, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.08)', fill: true }] }}
            options={{ ...sharedOptions, scales: { ...sharedOptions.scales, y: { title: { display: true, text: 'hPa' } } } }}
          />
        </div>
      )}

      {full && (
        <div>
          <h4>Full 10-day hourly</h4>
          <Line
            data={{
              labels: full.labels,
              datasets: [
                { label: 'Temperature (°C)', data: full.temp, borderColor: '#ef4444', yAxisID: 'y' },
                { label: 'Surface pressure (hPa)', data: full.pressure, borderColor: '#2563eb', yAxisID: 'y1' }
              ]
            }}
            options={{
              ...sharedOptions,
              scales: {
                x: sharedOptions.scales.x,
                y: { type: 'linear', position: 'left', title: { display: true, text: '°C' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'hPa' }, grid: { drawOnChartArea: false } }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
