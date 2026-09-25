const ITEMS = [
  { key: "roads", label: "Roads", fromCounts: "roads", fromList: (p) => p.roads?.length },
  { key: "gps", label: "GPS Tracks", fromCounts: "gps_tracks", fromList: (p) => p.gpsGeoJSON?.features?.length },
  { key: "sections", label: "Sections", fromCounts: "sections", fromList: (p) => p.sectionGeoJSON?.features?.length },
  { key: "assets", label: "Assets", fromCounts: "assets", fromList: (p) => p.assetGeoJSON?.features?.length },
  { key: "defects", label: "Defects", fromCounts: "defects", fromList: (p) => p.defectGeoJSON?.features?.length },
];

const ICONS = {
  roads: "▰",
  gps: "⌁",
  sections: "▤",
  assets: "◆",
  defects: "!",
};

export default function SummaryCards(props) {
  const { loading, counts } = props;

  return (
    <section className="cards" aria-label="Portfolio summary" aria-busy={loading}>
      {ITEMS.map((item) => {
        const value = counts?.[item.fromCounts] ?? item.fromList(props) ?? 0;
        return (
          <div className={`card summary-card summary-card-${item.key}`} key={item.key}>
            <div className="summary-card-label">
              <span className="summary-card-icon" aria-hidden="true">{ICONS[item.key]}</span>
              <span>{item.label}</span>
            </div>
            <strong aria-live="polite" className={loading ? "value-loading" : undefined}>
              {loading ? "…" : value.toLocaleString()}
            </strong>
            <span className="summary-card-caption">
              {item.key === "defects" ? "Reported items" : "In register"}
            </span>
          </div>
        );
      })}
    </section>
  );
}
