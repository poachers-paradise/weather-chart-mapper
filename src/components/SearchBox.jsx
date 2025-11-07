import React, { useState } from "react";
import axios from "axios";

export default function SearchBox({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function doSearch(e) {
    e && e.preventDefault();
    if (!q) return;
    setLoading(true);
    try {
      const res = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: { q, format: "json", limit: 6 }
      });
      setResults(res.data || []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="searchbox">
      <form onSubmit={doSearch}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search place or address" />
        <button type="submit">Search</button>
      </form>
      {loading && <div>Searching…</div>}
      <ul className="search-results">
        {results.map((r) => (
          <li key={r.place_id} onClick={() => onSelect({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), name: r.display_name })}>
            {r.display_name}
          </li>
        ))}
      </ul>
    </div>
  );
}
