import React, { useState, useEffect } from "react";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import ChartPanel from "./components/ChartPanel";
import GeoJsonUploader from "./components/GeoJsonUploader";
import { fetchOpenMeteoArchive } from "./services/weatherApi";

export default function App() {
  const [location, setLocation] = useState({ lat: 51.5074, lon: -0.1278, name: "London" });
  const [openMeteoData, setOpenMeteoData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 3);
        const fmt = (d) => d.toISOString().slice(0, 10);
        const data = await fetchOpenMeteoArchive(location.lat, location.lon, fmt(start), fmt(end));
        setOpenMeteoData(data);
      } catch (e) {
        console.error(e);
        setOpenMeteoData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [location]);

  return (
    <div className="app-root">
      <header className="app-header">Weather Chart Mapper — MVP</header>
      <div className="app-body">
        <aside className="sidebar">
          <SearchBox onSelect={(loc) => setLocation(loc)} />
          <GeoJsonUploader />
          <ChartPanel openMeteoData={openMeteoData} loading={loading} />
        </aside>
        <main className="map-area">
          <MapView center={{ lat: location.lat, lon: location.lon }} />
        </main>
      </div>
    </div>
  );
}
