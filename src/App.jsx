import React, { useState, useEffect, useCallback } from "react";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import ChartPanel from "./components/ChartPanel";
import GeoJsonUploader from "./components/GeoJsonUploader";
import { fetchOpenMeteoArchive } from "./services/weatherApi";
import { calculateThermalTimeSeries } from "./services/thermalCalculator";

export default function App() {
  const [location, setLocation] = useState({ lat: 51.5074, lon: -0.1278, name: "London" });
  const [openMeteoData, setOpenMeteoData] = useState(null);
  const [thermalData, setThermalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        // Request the full 10-day forecast starting from today (current day forward)
        const start = new Date();
        const end = new Date();
        end.setDate(start.getDate() + 9); // 10 days inclusive: day 0..9
        const fmt = (d) => d.toISOString().slice(0, 10);
        // use retries/timeouts via the service
        const data = await fetchOpenMeteoArchive(location.lat, location.lon, fmt(start), fmt(end), { attempts: 2, timeoutMs: 8000 });
        setOpenMeteoData(data);
        
        // Calculate thermal data
        const thermals = calculateThermalTimeSeries(data, {
          slope_deg: 0,
          aspect_deg: 0,
          zi: 1000
        });
        setThermalData(thermals);
      } catch (e) {
        console.error('Fetch Open-Meteo failed', e && e.message ? e.message : e);
        setOpenMeteDataToNull();
        setFetchError(e && e.message ? e.message : 'Failed to load forecast');
      } finally {
        setLoading(false);
      }
    }

    function setOpenMeteDataToNull() {
      setOpenMeteData(null);
    }

    load();
  }, [location]);

  const onRetry = useCallback(() => {
    // re-run effect by toggling location to same value (or explicitly rerun load)
    // Simpler: directly call fetch logic again
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const start = new Date();
        const end = new Date();
        end.setDate(start.getDate() + 9);
        const fmt = (d) => d.toISOString().slice(0, 10);
        const data = await fetchOpenMeteoArchive(location.lat, location.lon, fmt(start), fmt(end), { attempts: 2, timeoutMs: 8000 });
        setOpenMeteoData(data);
        
        // Calculate thermal data
        const thermals = calculateThermalTimeSeries(data, {
          slope_deg: 0,
          aspect_deg: 0,
          zi: 1000
        });
        setThermalData(thermals);
      } catch (e) {
        console.error('Retry fetch failed', e && e.message ? e.message : e);
        setOpenMeteData(null);
        setFetchError(e && e.message ? e.message : 'Retry failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [location]);

  return (
    <div className="app-root">
      <header className="app-header">Weather Chart Mapper — MVP</header>
      <div className="app-body">
        <aside className="sidebar">
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>POACHERS PARADISE MAGIC X</h2>
          <SearchBox onSelect={(loc) => setLocation(loc)} />
          <ChartPanel openMeteoData={openMeteoData} location={location} loading={loading} fetchError={fetchError} onRetry={onRetry} />
        </aside>
        <main className="map-area">
          <MapView 
            center={{ lat: location.lat, lon: location.lon }}
            thermalData={thermalData}
            onClick={(coords) => setLocation({ lat: coords.lat, lon: coords.lon, name: `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` })}
          />
        </main>
      </div>
    </div>
  );
}
