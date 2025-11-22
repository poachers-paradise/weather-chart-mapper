import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapView({ center = { lat: 51.5074, lon: -0.1278 }, onClick, thermalData }) {
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // North America bounds: [west, south, east, north]
    const northAmericaBounds = [
      [-168.0, 7.0],   // Southwest: Alaska/Central America
      [-52.0, 83.0]    // Northeast: Greenland/Arctic
    ];
    
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'usgs-topo': {
            type: 'raster',
            tiles: [
              'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'USGS The National Map'
          },
          'usgs-imagery-topo': {
            type: 'raster',
            tiles: [
              'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'USGS The National Map'
          }
        },
        layers: [
          {
            id: 'usgs-topo-layer',
            type: 'raster',
            source: 'usgs-topo',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      },
      center: [center.lon, center.lat],
      zoom: 6,
      maxBounds: northAmericaBounds
    });

    const marker = new maplibregl.Marker().setLngLat([center.lon, center.lat]).addTo(mapRef.current);

    mapRef.current.on("click", (e) => {
      const { lat, lng } = e.lngLat;
      marker.setLngLat([lng, lat]); // Move marker to clicked location
      onClick && onClick({ lat, lon: lng });
    });

    return () => mapRef.current && mapRef.current.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter([center.lon, center.lat]);
  }, [center]);

  // Draw thermal arrows on canvas overlay
  useEffect(() => {
    if (!mapRef.current || !thermalData || thermalData.length === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const thermalOverlay = {
      onAdd: function(map, gl) {
        this.map = map;
        this.canvas = canvas;
        canvas.width = map.getCanvas().width;
        canvas.height = map.getCanvas().height;
        return canvas;
      },
      
      render: function() {
        const map = this.map;
        canvas.width = map.getCanvas().width;
        canvas.height = map.getCanvas().height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!thermalData || selectedHourIndex >= thermalData.length) return;
        
        const thermal = thermalData[selectedHourIndex];
        if (!thermal) return;

        // Draw thermal strength indicator at center
        const centerPoint = map.project([center.lon, center.lat]);
        
        // Color based on thermal score (0-1)
        const score = thermal.score;
        const r = Math.floor(255 * (1 - score)); // Red when weak
        const g = Math.floor(255 * score);       // Green when strong
        const b = 50;
        
        // Draw circle representing thermal strength
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        const radius = 20 + (score * 80); // 20-100px radius based on score
        ctx.beginPath();
        ctx.arc(centerPoint.x, centerPoint.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw arrow pattern showing updraft
        if (score > 0.2) { // Only show arrows for decent thermals
          const arrowCount = Math.min(8, Math.floor(score * 12));
          for (let i = 0; i < arrowCount; i++) {
            const angle = (i / arrowCount) * 2 * Math.PI;
            const distance = radius * 0.6;
            const x = centerPoint.x + Math.cos(angle) * distance;
            const y = centerPoint.y + Math.sin(angle) * distance;
            
            // Draw upward arrow
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(x, y - 10);
            ctx.stroke();
            
            // Arrow head
            ctx.beginPath();
            ctx.moveTo(x - 4, y - 6);
            ctx.lineTo(x, y - 10);
            ctx.lineTo(x + 4, y - 6);
            ctx.stroke();
          }
        }
        
        // Draw thermal info text
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 14px Arial';
        const scoreText = `Thermal: ${(score * 100).toFixed(0)}%`;
        const wstarText = `w*: ${thermal.wstar?.toFixed(1) || 'N/A'} m/s`;
        
        ctx.strokeText(scoreText, centerPoint.x - 40, centerPoint.y - radius - 10);
        ctx.fillText(scoreText, centerPoint.x - 40, centerPoint.y - radius - 10);
        ctx.strokeText(wstarText, centerPoint.x - 40, centerPoint.y - radius + 5);
        ctx.fillText(wstarText, centerPoint.x - 40, centerPoint.y - radius + 5);
        
        return true;
      }
    };

    if (!mapRef.current.getLayer('thermal-overlay')) {
      mapRef.current.addLayer({
        id: 'thermal-overlay',
        type: 'custom',
        renderingMode: '2d',
        ...thermalOverlay
      });
    }

    mapRef.current.triggerRepaint();
    
    return () => {
      if (mapRef.current && mapRef.current.getLayer('thermal-overlay')) {
        mapRef.current.removeLayer('thermal-overlay');
      }
    };
  }, [thermalData, selectedHourIndex, center]);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      
      {/* Time selector for thermal data */}
      {thermalData && thermalData.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          zIndex: 1000,
          minWidth: "300px"
        }}>
          <div style={{ marginBottom: "8px", fontWeight: "bold", fontSize: "12px", color: "#333" }}>
            {thermalData[selectedHourIndex]?.time || 'Loading...'}
          </div>
          <input
            type="range"
            min="0"
            max={thermalData.length - 1}
            value={selectedHourIndex}
            onChange={(e) => setSelectedHourIndex(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#666", display: "flex", justifyContent: "space-between" }}>
            <span>Hour {selectedHourIndex + 1} of {thermalData.length}</span>
            <span>Score: {(thermalData[selectedHourIndex]?.score * 100 || 0).toFixed(0)}%</span>
          </div>
        </div>
      )}
      
      {/* Legend */}
      {thermalData && thermalData.length > 0 && (
        <div style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          fontSize: "12px",
          zIndex: 1000
        }}>
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Thermal Strength</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ width: "20px", height: "20px", backgroundColor: "rgba(50, 255, 50, 0.3)", border: "2px solid rgb(50, 255, 50)", borderRadius: "50%" }}></div>
            <span>Strong (80-100%)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ width: "20px", height: "20px", backgroundColor: "rgba(150, 200, 50, 0.3)", border: "2px solid rgb(150, 200, 50)", borderRadius: "50%" }}></div>
            <span>Moderate (40-80%)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "20px", backgroundColor: "rgba(255, 100, 50, 0.3)", border: "2px solid rgb(255, 100, 50)", borderRadius: "50%" }}></div>
            <span>Weak (0-40%)</span>
          </div>
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #ddd", fontSize: "10px", color: "#666" }}>
            Arrows show updraft pattern
          </div>
        </div>
      )}
    </div>
  );
}
