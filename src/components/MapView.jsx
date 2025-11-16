import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapView({ center = { lat: 51.5074, lon: -0.1278 }, onClick }) {
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

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
