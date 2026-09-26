export default function PhotoAIPanel({
  photo,
  updatePhoto,
  submitPhoto,
  captureGPS,
  saving,
  uploadedImageId,
  aiResults,
  aiRunning,
  detectPhoto,
  loadExistingDetections,
  aiStatus,
  aiMessage,
}) {
  const ready = aiStatus?.ready === true;
  const stub = aiStatus?.stub_mode === true;

  return (
    <section className="form-panel">
      <div className="form-header">
        <div>
          <h2>Field Photo + AI Inspection</h2>
          <p>Upload a road photo, capture GPS, then run the configured road-defect model.</p>
        </div>
      </div>

      {aiStatus && (
        <div
          className={`ai-status-banner ${ready ? (stub ? "stub" : "ready") : "unavailable"}`}
          role="status"
        >
          <strong>
            {ready
              ? stub
                ? "Experimental — stub mode"
                : "Model ready"
              : "Model unavailable"}
          </strong>
          <span>
            {stub
              ? "AI detections are simulated for demos. Results are not from a trained production model."
              : aiStatus.message}
          </span>
        </div>
      )}
      {aiMessage && (
        <p className="ai-inline-message" role="status">
          {aiMessage}
        </p>
      )}

      <form onSubmit={submitPhoto}>
        <label>
          Road Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => updatePhoto("file", e.target.files?.[0] || null)}
          />
        </label>
        <label>
          Inspection ID (optional)
          <input
            type="number"
            value={photo.inspection_id}
            onChange={(e) => updatePhoto("inspection_id", e.target.value)}
          />
        </label>
        <label>
          Defect ID (optional)
          <input
            type="number"
            value={photo.defect_id}
            onChange={(e) => updatePhoto("defect_id", e.target.value)}
          />
        </label>
        <label>
          Latitude
          <input
            type="number"\tableofcontents="0.000001"
            value={photo.latitude}
            onChange={(e) => updatePhoto("latitude", e.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="0.000001"
            value={photo.longitude}
            onChange={(e) => updatePhoto("longitude", e.target.value)}
          />
        </label>
        <label>
          Captured At
          <input
            type="datetime-local"
            value={photo.captured_at}
            onChange={(e) => updatePhoto("captured_at", e.target.value)}
          />
        </label>
        <div className="form-footer">
          <button type="button" onClick={captureGPS}>
            Capture GPS
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Uploading…" : "Upload Photo"}
          </button>
        </div>
      </form>

      {uploadedImageId && (
        <div className="ai-box">
          <p>
            Uploaded image ID: <strong>{uploadedImageId}</strong>
          </p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={detectPhoto}
              disabled={aiRunning || (aiStatus && !ready)}
            >
              {aiRunning ? "Detecting…" : "Run AI Detection"}
            </button>
            <button type="button" onClick={loadExistingDetections}>
              Load Existing Detections
            </button>
          </div>
          {aiResults?.length > 0 && (
            <div className="ai-results">
              {aiResults.map((r, i) => (
                <div key={r.detection_id || i} className="ai-result">
                  <strong>{r.defect_type}</strong>
                  <small>
                    {r.confidence != null ? ` · ${(Number(r.confidence) * 100).toFixed(1)}%` : ""}
                    {r.model_name ? ` · ${r.model_name}` : ""}
                    {stub ? " · experimental" : ""}
                  </small>
                </div>
              ))}
            </div>
          )}
          {aiResults?.length === 0 && !aiRunning && (
            <p className="ai-empty">No detections stored for this image yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
