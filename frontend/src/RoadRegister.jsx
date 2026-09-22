import { useCallback, useEffect, useState } from "react";
import {
  archiveRoad,
  createRoad,
  deleteRoad,
  generateRoadSections,
  getRoadSections,
  getRoads,
  updateRoad,
} from "./api";
import RoadGeometryDrawer from "./RoadGeometryDrawer";
import EmptyState from "./components/EmptyState";

const EMPTY_FORM = {
  road_code: "",
  road_name: "",
  road_class: "",
  surface_type: "",
  start_location: "",
  end_location: "",
  total_length_km: "",
  status: "active",
  geometry_wkt: "",
};

const selectedRoadStyles = `
  .road-register .selected-road-banner {
    display: flex; align-items: center; gap: .75rem; margin: 1rem 0;
    padding: 1rem 1.15rem; border: 2px solid #c7a764; border-radius: 12px;
    background: linear-gradient(90deg, #f7f1e5, #efe7d5); color: #4d3c25;
    font-weight: 700; box-shadow: 0 4px 14px rgba(123, 96, 52, 0.12);
  }
  .road-register .selected-road-banner::before {
    content: "✓"; display: grid; place-items: center; width: 30px; height: 30px;
    border-radius: 50%; background: #b68d45; color: white; font-size: 1.1rem;
  }
  .road-register tbody tr.road-row { cursor: pointer; }
  .road-register tbody tr.road-row:focus-visible td { outline: 3px solid #b68d45; outline-offset: -3px; }
  .road-register tr.row-selected td {
    background: #2f466a !important; color: white !important;
    border-top: 3px solid #d7b36a; border-bottom: 3px solid #d7b36a;
    font-weight: 700; box-shadow: inset 0 8px 16px rgba(15, 23, 42, 0.08), inset 0 -8px 16px rgba(15, 23, 42, 0.08);
  }
  .road-register tr.row-selected td:first-child {
    border-left: 8px solid #b68d45; padding-left: calc(.9rem - 7px);
  }
  .road-register tr.row-selected td:last-child { border-right: 3px solid #d7b36a; }
  .road-register tr.row-selected:hover td { background: #3a527c !important; }
  .road-register .road-code-cell { display: inline-flex; align-items: center; gap: .55rem; }
  .road-register .selected-road-badge {
    display: inline-flex; align-items: center; padding: .3rem .55rem;
    border-radius: 999px; background: #d8bf82; color: #342b1a;
    font-size: .7rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .road-register .selected-action {
    background: #d8bf82 !important; color: #2d2418 !important; border-color: #b68d45 !important; font-weight: 800;
  }
  .road-register .danger-action {
    color: #991b1b !important; border-color: #fca5a5 !important;
  }
  .road-register .danger-action:hover {
    background: #fef2f2 !important;
  }
  .road-draw-panel {
    margin: 1rem 0 1.25rem; padding: 1rem;
    border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc;
  }
  .road-draw-toolbar, .road-draw-stats {
    display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem;
  }
  .road-draw-stats span { font-size: 0.9rem; color: #475569; }
  .road-draw-stats .draw-mode-on { color: #0369a1; font-weight: 700; }
  .road-draw-stats .draw-mode-off { color: #64748b; }
  .road-draw-map {
    border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1;
    margin-bottom: 0.75rem;
  }
  .road-draw-wkt textarea { font-family: ui-monospace, monospace; font-size: 0.8rem; }
`;
