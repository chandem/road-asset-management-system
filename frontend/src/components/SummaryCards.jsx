export default function SummaryCards({ loading, roads, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON }) {
  return (
    <section className="cards">
      <div className="card"><span>Roads</span><strong>{loading ? "…" : roads.length}</strong></div>
      <div className="card"><span>GPS Tracks</span><strong>{loading ? "…" : gpsGeoJSON?.features?.length ?? 0}</strong></div>
      <div className="card"><span>Sections</span><strong>{loading ? "…" : sectionGeoJSON?.features?.length ?? 0}</strong></div>
      <div className="card"><span>Assets</span><strong>{loading ? "…" : assetGeoJSON?.features?.length ?? 0}</strong></div>
      <div className="card"><span>Defects</span><strong>{loading ? "…" : defectGeoJSON?.features?.length ?? 0}</strong></div>
    </section>
  );
}
