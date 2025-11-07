import React, { useMemo } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import { Line } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function ChartPanel({ openMeteoData, nwsObservations, loading }) {
  const chartData = useMemo(() => {
    if (!openMeteoData || !openMeteoData.hourly) return null;
    const time = openMeteoData.hourly.time || [];
    const temp = openMeteoData.hourly.temperature_2m || [];
    const pressure = openMeteoData.hourly.surface_pressure || [];
    return {
      labels: time,
      datasets: [
        { label: "Temperature (°C)", data: temp, borderColor: "#ef4444", yAxisID: "y" },
        { label: "Surface pressure (hPa)", data: pressure, borderColor: "#2563eb", yAxisID: "y1" }
      ]
    };
  }, [openMeteoData]);

  const options = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: { type: 'linear', position: 'left' },
      y1: { type: 'linear', position: 'right' }
    }
  };

  return (
    <div className="chart-container">
      <h3>Hourly</h3>
      {loading && <div>Loading data…</div>}
      {!chartData && !loading && <div>No data available</div>}
      {chartData && <Line data={chartData} options={options} />}
    </div>
  );
}
