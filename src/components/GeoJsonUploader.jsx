import React, { useState } from "react";

export default function GeoJsonUploader() {
  const [geojson, setGeojson] = useState(null);

  function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setGeojson(parsed);
      } catch (err) {
        console.error("Invalid GeoJSON", err);
        setGeojson(null);
      }
    };
    reader.readAsText(f);
  }

  return (
    <div className="uploader">
      <label>
        Upload GeoJSON
        <input type="file" accept="application/geo+json,application/json" onChange={handleFile} />
      </label>
      {geojson && <pre style={{ maxHeight: 200, overflow: "auto" }}>{JSON.stringify(geojson, null, 2)}</pre>}
    </div>
  );
}
