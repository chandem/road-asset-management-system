export default function SummaryCards({ loading, counts, roads, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON }) {
  const roadsN = counts?.roads ?? roads?.length ?? 0;
  const gpsN = counts?.gps_tracks ?? gpsGeoJSON?.features?.length ?? 0;
  const sectionsN = counts?.sections ?? sectionGeoJSON?.features?.length ?? 0;
  const assetsN = counts?.assets ?? assetGeoJSON?.features?.length ?? 0;
  const defectsN = counts?.defects ?? defectGeoJSON?.features?.length ?? 0;

  return (
    <section className="cards">
      <div className="card"><span>Roads</span><strong>{loading ? "…" : roadsN}</strong></div>
      <div className="card"><span>GPS Tracks</span><strong>{loading ? "…" : gpsN}</strong></div>
      <div className="card"><span>Sections</span><strong>{loading ? "…" : sectionsN}</strong></div>
      <div className="card"><span>Assets</span><strong>{loading ? "…" : assetsN}</strong></div>
      <div className="card"><span>Defects</span><strong>{loading ? "…" : defectsN}</strong></div>
    </section>
  );
}
