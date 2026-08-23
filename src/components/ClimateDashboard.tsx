import { useMemo, useState } from "react";
import ClimateChart, { type MetricKey } from "./ClimateChart";
import {
  datasets,
  fmtDelta,
  modeCopy,
  pollutants,
  regionNames,
  regions,
  type RegionName,
  type TemporalMode,
} from "../mock/climateData";

const TEMPORAL_MODES: { mode: TemporalMode; label: string }[] = [
  { mode: "weeks", label: "Weeks" },
  { mode: "months", label: "Months" },
  { mode: "years", label: "Years" },
];

export default function ClimateDashboard() {
  const [mode, setMode] = useState<TemporalMode>("years");
  const [region, setRegion] = useState<RegionName>("Global");
  const [query, setQuery] = useState("");
  const [hoveredMetric, setHoveredMetric] = useState<MetricKey | null>(null);

  const dataset = datasets[mode];
  const copy = modeCopy[mode];

  const deltaLabel = mode === "years" ? "YoY" : mode === "months" ? "MoM" : "WoW";
  const last = dataset.points[dataset.points.length - 1];
  const prev = dataset.points[dataset.points.length - 2];
  const airDelta = fmtDelta(last.co2 - prev.co2);
  const earthDelta = fmtDelta(last.temp - prev.temp);
  const oceanDelta = fmtDelta(last.sl - prev.sl);

  const regionList = useMemo(() => {
    const list = (regions[region] || []).map((r) => ({
      item: r,
      search: (r.name + " " + r.metric + " " + r.sub).toLowerCase(),
    }));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return list.filter((r) => r.search.indexOf(q) !== -1);
    }
    return list;
  }, [region, query]);

  return (
    <>
      <header className="topbar" data-od-id="topbar">
        <div className="shell topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
              </svg>
            </span>
            <span className="brand-title">
              Global Climate Intelligence
              <small>Environmental monitoring · Live</small>
            </span>
          </div>

          <label className="search" data-od-id="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              id="search-input"
              placeholder="Search region, pollutant, event…"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="select-wrap" data-od-id="region-selector">
            <select
              id="region-select"
              aria-label="Region"
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionName)}
            >
              {regionNames.map((r) => (
                <option key={r} value={r}>
                  {r === "Amazon" ? "Amazon basin" : r}
                </option>
              ))}
            </select>
          </div>

          <div
            className="status-chip"
            data-od-id="warming-metric"
            title="Baseline offset vs. pre-industrial (1850–1900) mean"
          >
            <span className="dot" />
            <span className="val" id="warming-value">
              +1.42°C
            </span>
            <span className="lbl">warming rate</span>
          </div>

          <div className="seg" role="tablist" aria-label="Temporal range" data-od-id="temporal-switcher">
            {TEMPORAL_MODES.map((m) => (
              <button
                key={m.mode}
                role="tab"
                aria-selected={mode === m.mode}
                aria-pressed={mode === m.mode}
                data-mode={m.mode}
                onClick={() => setMode(m.mode)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="shell page" id="content">
        <section className="kpi-grid" data-od-id="summary-cards" aria-label="Summary indicators">
          <div className="card kpi" data-od-id="kpi-air">
            <div className="card-head">
              <span className="card-title">
                <span className="cat" style={{ background: "var(--accent)" }} />
                Air
              </span>
              <span className={"delta " + airDelta.cls} id="air-delta">
                <span className="range-lbl">{deltaLabel}</span> {airDelta.text} ppm
              </span>
            </div>
            <div className="kpi-value">
              428.2<span className="unit">ppm CO₂</span>
            </div>
            <div className="kpi-sub">
              <span>Methane CH₄</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>1,930 ppb</span>
            </div>
          </div>

          <div className="card kpi" data-od-id="kpi-earth">
            <div className="card-head">
              <span className="card-title">
                <span className="cat" style={{ background: "var(--danger)" }} />
                Earth
              </span>
              <span className={"delta " + earthDelta.cls} id="earth-delta">
                <span className="range-lbl">{deltaLabel}</span> {earthDelta.text}°C
              </span>
            </div>
            <div className="kpi-value">
              +1.92<span className="unit">°C</span>
            </div>
            <div className="kpi-sub">
              <span>Land surface anomaly · Jul peak</span>
            </div>
          </div>

          <div className="card kpi" data-od-id="kpi-ocean">
            <div className="card-head">
              <span className="card-title">
                <span className="cat" style={{ background: "var(--success)" }} />
                Ocean
              </span>
              <span className={"delta " + oceanDelta.cls} id="ocean-delta">
                <span className="range-lbl">{deltaLabel}</span> {oceanDelta.text} mm
              </span>
            </div>
            <div className="kpi-value">
              +98.5<span className="unit">mm</span>
            </div>
            <div className="kpi-sub">
              <span>Sea level rise vs. 2000</span>
              <span className="tag">SST elevated</span>
            </div>
          </div>

          <div className="card kpi" data-od-id="kpi-super">
            <div className="card-head">
              <span className="card-title">
                <span className="cat" style={{ background: "var(--warn)" }} />
                Super Pollutants
              </span>
              <span className="delta up" id="super-delta">
                <span className="range-lbl">{deltaLabel}</span> +4.3%
              </span>
            </div>
            <div className="kpi-value">
              HFCs<span className="unit">+ SF₆</span>
            </div>
            <div className="kpi-sub">
              <span>Fluorinated gases &amp; black carbon</span>
            </div>
          </div>
        </section>

        <section className="stage" data-od-id="main-stage">
          <div className="card chart-card" data-od-id="chart-panel">
            <div className="chart-head">
              <div>
                <h2 className="chart-title" id="chart-title">
                  {copy.title}
                </h2>
                <p className="chart-subtitle" id="chart-subtitle">
                  {copy.sub}
                </p>
              </div>
              <div className="legend" id="chart-legend">
                <span className="axis-info-wrap">
                  <span className="axis-info" tabIndex={0}>
                    ⓘ
                  </span>
                  <span className="axis-info-tip" role="tooltip">
                    Y-axis: each line is scaled 0–100 to its own min/max over the range shown — index = (value − min)
                    / (max − min) × 100. This makes trend shape comparable across °C, ppm and mm, since they don't
                    share a real unit. Hover the chart to see the actual value at any point.
                  </span>
                </span>
                <span
                  className={"legend-item" + (hoveredMetric && hoveredMetric !== "temp" ? " dim" : "")}
                  onMouseEnter={() => setHoveredMetric("temp")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <span className="legend-swatch dot" style={{ background: "var(--danger)" }} />
                  Temp anomaly
                </span>
                <span
                  className={"legend-item" + (hoveredMetric && hoveredMetric !== "co2" ? " dim" : "")}
                  onMouseEnter={() => setHoveredMetric("co2")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <span className="legend-swatch dot" style={{ background: "var(--accent)" }} />
                  CO₂
                </span>
                <span
                  className={"legend-item" + (hoveredMetric && hoveredMetric !== "sl" ? " dim" : "")}
                  onMouseEnter={() => setHoveredMetric("sl")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <span className="legend-swatch dot" style={{ background: "var(--success)" }} />
                  Sea level
                </span>
              </div>
            </div>

            <ClimateChart mode={mode} dataset={dataset} hoveredMetric={hoveredMetric} onHoverMetric={setHoveredMetric} />

            <div className="chart-note">
              <span>Lines indexed for shape comparison &nbsp;|&nbsp; hover for actual values</span>
              <span id="chart-mode-note">{copy.note}</span>
            </div>
          </div>

          <aside className="side-stack" data-od-id="side-panel">
            <div className="card" data-od-id="pollutant-breakdown">
              <div className="bd-head">
                <span className="h">Super Pollutant Breakdown</span>
                <span className="meta">share of non-CO₂ forcing</span>
              </div>
              <div className="breakdown" id="pollutant-list" style={{ marginTop: "var(--space-3)" }}>
                {pollutants.map((p) => {
                  const badgeCls = p.trend === "up" ? "up" : "flat";
                  const arrow = p.trend === "up" ? "↑ rising" : "→ stable";
                  return (
                    <div className="bd-row" key={p.name}>
                      <span className="bd-name">
                        <span className="mini-dot" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="bd-value">{Math.round(p.share * 100)}%</span>
                      <span className="bd-bar">
                        <span style={{ width: p.share * 100 + "%", background: p.color }} />
                      </span>
                      <span className="bd-note">
                        <span className={"delta " + badgeCls}>{arrow}</span> {p.note}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card" data-od-id="regional-breakdown">
              <div className="bd-head">
                <span className="h" id="region-title">
                  Regional Breakdown · {region}
                </span>
                <span className="meta" id="region-note">
                  status · trend
                </span>
              </div>
              <div id="region-list" style={{ marginTop: "var(--space-2)" }}>
                {regionList.map((r) => (
                  <div className="region-item" key={r.item.name}>
                    <span className="r-name">{r.item.name}</span>
                    <span className="r-metric">
                      <b>{r.item.metric}</b>
                      {r.item.sub}
                    </span>
                    <span className={"badge " + r.item.badge}>
                      <span className="pulse" />
                      {r.item.badgeText}
                    </span>
                  </div>
                ))}
              </div>
              {regionList.length === 0 && (
                <p className="empty" id="region-empty">
                  No regions match your search.
                </p>
              )}
            </div>
          </aside>
        </section>
      </main>

      <footer className="footbar" data-od-id="footer">
        <div className="shell footbar-inner">
          <span className="live">
            <span className="pulse" />
            LIVE · updated 23 Aug 2026, 14:02 UTC
          </span>
          <span>Sources: NOAA · NASA GISS · ESA CCI · prototype estimates for evaluation</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>Dataset: 27yr annual · 60mo · 120d</span>
        </div>
      </footer>
    </>
  );
}
