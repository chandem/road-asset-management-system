const ITEMS = [
  { key: "roads", label: "Roads", fromCounts: "roads", fromList: (p) => p.roads?.length },
  { key: "gps", label: "GPS Tracks", fromCounts: "gps_tracks", fromList: (p) => p.gpsGeoJSON?.features?.length },
  { key: "sections", label: "Sections", fromCounts: "sections", fromList: (p) => p.sectionGeoJSON?.features?.length },
  { key: "assets", label: "Assets", fromCounts: "assets", fromList: (p) => p.assetGeoJSON?.features?.length },
  { key: "defects", label: "Defects", fromCounts: "defects", fromList: (p) => p.defectGeoJSON?.features?.length },
];

export default function SummaryCards(props) {
  const { loading, counts } = props;

  return (
    <section className="cards" aria-label="Portfolio summary">
      {ITEMS.map((item) => {
        const value = counts?.[item.fromCounts] ?? item.fromList(props) ?? 0;
        return (
          <div className="card" key={item.key}>
            <span>{item.label}</span>
            <strong aria-live="polite">{loading ? "…" : value}</strong>
          </div>
        );
      })}
    </section>
  );
}
