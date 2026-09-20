import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, useMapEvents, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [9.02, 38.75]; // Addis Ababa area

/** Approximate length in km from lat/lng vertices (haversine). */
export function pathLengthKm(latLngs) {
  if (!latLngs || latLngs.length < 2) return 0;
  const R = 6371;
  let total = 0;
  for (let i = 1; i < latLngs.length; i += 1) {
    const [lat1, lon1] = latLngs[i - 1];
    const [lat2, lon2] = latLngs[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(total * 1000) / 1000;
}

/** Leaflet [lat,lng][] → WKT LINESTRING(lon lat, ...) */
export function latLngsToWkt(latLngs) {
  if (!latLngs || latLngs.length < 2) return "";
  const coords = latLngs
    .map(([lat, lng]) => `${Number(lng).toFixed(6)} ${Number(lat).toFixed(6)}`)
    .join(", ");
  return `LINESTRING(${coords})`;
}

function ClickCapture({ enabled, onAdd }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function FitDrawn({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length < 2) return;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [points, map]);
  return null;
}

/**
 * Interactive map to digitize a road centerline.
 * Props:
 *  - initialPoints: optional [[lat,lng], ...]
 *  - onApply({ geometry_wkt, total_length_km, points })
 *  - onCancel()
 */
export default function RoadGeometryDrawer({
  initialPoints = [],
  onApply,
  onCancel,
  title = "Draw road geometry",
}) {
  const [points, setPoints] = useState(() =>
    Array.isArray(initialPoints) ? initialPoints.map((p) => [...p]) : [],
  );
  const [drawing, setDrawing] = useState(true);
  const mapRef = useRef(null);

  const lengthKm = useMemo(() => pathLengthKm(points), [points]);
  const wkt = useMemo(() => latLngsToWkt(points), [points]);

  function addPoint(pt) {
    setPoints((prev) => [...prev, pt]);
  }

  function undo() {
    setPoints((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setPoints([]);
    setDrawing(true);
  }

  function finish() {
    if (points.length < 2) return;
    setDrawing(false);
  }

  function apply() {
    if (points.length < 2 || !wkt) return;
    onApply?.({
      geometry_wkt: wkt,
      total_length_km: lengthKm,
      points,
    });
  }

  return (
    <div className="road-draw-panel" aria-label={title}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p>
            {drawing
              ? "Click the map to add vertices along the road. Need at least 2 points."
              : "Line finished. Apply to save WKT and estimated length into the form."}
          </p>
        </div>
      </div>

      <div className="road-draw-toolbar">
        <button type="button" onClick={() => setDrawing(true)} disabled={drawing}>
          Continue drawing
        </button>
        <button type="button" onClick={undo} disabled={!points.length}>
          Undo point
        </button>
        <button type="button" onClick={clearAll} disabled={!points.length}>
          Clear
        </button>
        <button type="button" onClick={finish} disabled={points.length < 2 || !drawing}>
          Finish line
        </button>
        <button
          type="button"
          className="primary"
          onClick={apply}
          disabled={points.length < 2}
        >
          Apply to road form
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Close
          </button>
        )}
      </div>

      <div className="road-draw-stats">
        <span>
          Points: <strong>{points.length}</strong>
        </span>
        <span>
          Est. length: <strong>{lengthKm || "—"}</strong> km
        </span>
        <span className={drawing ? "draw-mode-on" : "draw-mode-off"}>
          {drawing ? "Drawing on — click map" : "Drawing paused"}
        </span>
      </div>

      <div className="road-draw-map">
        <MapContainer
          center={points[0] || DEFAULT_CENTER}
          zoom={12}
          style={{ height: "360px", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture enabled={drawing} onAdd={addPoint} />
          {points.length > 0 && (
            <Polyline positions={points} pathOptions={{ color: "#0284c7", weight: 5 }} />
          )}
          <FitDrawn points={points} />
        </MapContainer>
      </div>

      {wkt && (
        <label className="road-draw-wkt">
          Geometry WKT (preview)
          <textarea readOnly rows={2} value={wkt} />
        </label>
      )}
    </div>
  );
}
