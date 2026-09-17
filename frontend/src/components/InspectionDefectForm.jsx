export default function InspectionDefectForm({
  formType,
  form,
  update,
  sections,
  submitForm,
  saving,
  message,
  onClose,
}) {
  return (
    <section className="form-panel">
      <div className="form-header">
        <h2>{formType === "inspection" ? "New Road Inspection" : "New Road Defect"}</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <form onSubmit={submitForm}>
        {formType === "inspection" ? (
          <>
            <label>Road Section
              <select value={form.section_id} onChange={(e) => update("section_id", e.target.value)} required>
                <option value="">Select section</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.section_code} ({s.start_chainage}–{s.end_chainage} km)
                  </option>
                ))}
              </select>
            </label>
            <label>Inspection Date
              <input type="date" value={form.inspection_date} onChange={(e) => update("inspection_date", e.target.value)} required />
            </label>
            <label>Condition Rating
              <input type="number" min="0" max="100" step="0.01" value={form.condition_rating} onChange={(e) => update("condition_rating", e.target.value)} />
            </label>
            <label>Weather
              <input value={form.weather} onChange={(e) => update("weather", e.target.value)} />
            </label>
            <label>Notes
              <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label>Inspection ID
              <input type="number" value={form.inspection_id} onChange={(e) => update("inspection_id", e.target.value)} required />
            </label>
            <label>Road Section
              <select value={form.section_id} onChange={(e) => update("section_id", e.target.value)}>
                <option value="">Use inspection section</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>{s.section_code}</option>
                ))}
              </select>
            </label>
            <label>Defect Type
              <input value={form.defect_type} onChange={(e) => update("defect_type", e.target.value)} required />
            </label>
            <label>Severity
              <select value={form.severity} onChange={(e) => update("severity", e.target.value)}>
                <option value="">Select</option>
                <option>low</option>
                <option>medium</option>
                <option>high</option>
                <option>critical</option>
              </select>
            </label>
            <label>Chainage (km)
              <input type="number" min="0" step="0.001" value={form.chainage_km} onChange={(e) => update("chainage_km", e.target.value)} />
            </label>
            <label>Length (m)
              <input type="number" min="0" step="0.01" value={form.length_m} onChange={(e) => update("length_m", e.target.value)} />
            </label>
            <label>Width (m)
              <input type="number" min="0" step="0.01" value={form.width_m} onChange={(e) => update("width_m", e.target.value)} />
            </label>
            <label>Depth (mm)
              <input type="number" min="0" step="0.1" value={form.depth_mm} onChange={(e) => update("depth_mm", e.target.value)} />
            </label>
            <label>Detected By
              <select value={form.detected_by} onChange={(e) => update("detected_by", e.target.value)}>
                <option>manual</option>
                <option>gps</option>
                <option>ai</option>
              </select>
            </label>
            <label>Description
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)} />
            </label>
          </>
        )}
        <div className="form-footer">
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Record"}</button>
          {message && <span>{message}</span>}
        </div>
      </form>
    </section>
  );
}
