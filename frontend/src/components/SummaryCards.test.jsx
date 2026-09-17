import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SummaryCards from "./SummaryCards";

describe("SummaryCards", () => {
  it("shows placeholders while loading", () => {
    render(<SummaryCards loading />);
    const placeholders = screen.getAllByText("…");
    expect(placeholders.length).toBeGreaterThanOrEqual(5);
  });

  it("prefers counts prop over geo feature lengths", () => {
    render(
      <SummaryCards
        loading={false}
        counts={{ roads: 7, gps_tracks: 2, sections: 11, assets: 3, defects: 9 }}
        roads={[]}
        gpsGeoJSON={{ features: [] }}
        sectionGeoJSON={{ features: [] }}
        assetGeoJSON={{ features: [] }}
        defectGeoJSON={{ features: [] }}
      />,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
