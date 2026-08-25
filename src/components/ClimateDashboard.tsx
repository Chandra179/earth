import { useEffect, useMemo, useRef, useState } from "react";
import ClimateChart, { type MetricKey } from "./ClimateChart";
import { COMPARE_FACTORS, regionNames, type RegionName, type TemporalMode } from "../domain/climate";
import { useClimateData } from "../hooks/useClimateData";

function fmtDelta(d: number) {
  const cls = Math.abs(d) < 1e-9 ? "flat" : d > 0 ? "up" : "down";
  const sign = d > 0 ? "+" : "";
  return { cls, text: sign + d.toFixed(2) };
}

const modeCopy: Record<TemporalMode, { title: string; sub: string; note: string }> = {
  years: {
    title: "Temperature anomaly vs. atmospheric CO₂",
    sub: "Annual means · 2000–2026 · projection to 2030",
    note: "Reference line: +1.5°C Paris threshold",
  },
  months: {
    title: "Seasonal ice melt & ocean heat cycle",
    sub: "Monthly means · 60-month window",
    note: "Month-over-month (MoM) deltas shown",
  },
  weeks: {
    title: "Short-term anomalies & methane events",
    sub: "Daily points with 7-day moving average · last 120 days",
    note: "Week-over-week (WoW) deltas shown",
  },
};

function Term({ word, children }: { word: string; children: React.ReactNode }) {
  return (
    <span className="term" tabIndex={0}>
      {word}
      <span className="tip" role="tooltip">
        {children}
      </span>
    </span>
  );
}

function NoteWithTerm({ note, word, def }: { note: string; word?: string; def?: string }) {
  if (!word || !def || !note.includes(word)) return <>{note}</>;
  const [before, after] = note.split(word);
  return (
    <>
      {before}
      <Term word={word}>{def}</Term>
      {after}
    </>
  );
}

const CHART_TITLE = "Temperature anomaly, CO₂ & sea level";

const TEMPORAL_MODES: { mode: TemporalMode; label: string }[] = [
  { mode: "weeks", label: "Week" },
  { mode: "months", label: "Month" },
  { mode: "years", label: "Year" },
];

export default function ClimateDashboard() {
  const [mode, setMode] = useState<TemporalMode>("years");
  const [region, setRegion] = useState<RegionName>("Global");
  const [query, setQuery] = useState("");
  const [hoveredMetric, setHoveredMetric] = useState<MetricKey | null>(null);
  const [compare, setCompare] = useState("");
  const [playSignal, setPlaySignal] = useState(0);
  const [focusReq, setFocusReq] = useState<{ i: number; n: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const { snapshot } = useClimateData();

  useEffect(() => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const hm = h.get("mode");
    if (hm && snapshot.datasets[hm as TemporalMode]) setMode(hm as TemporalMode);
    const hr = h.get("region");
    if (hr && (regionNames as readonly string[]).includes(hr)) setRegion(hr as RegionName);
    const hc = h.get("compare");
    if (hc && COMPARE_FACTORS[hc]) setCompare(hc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const parts = ["mode=" + mode, "region=" + encodeURIComponent(region)];
    if (compare) parts.push("compare=" + encodeURIComponent(compare));
    try {
      history.replaceState(null, "", "#" + parts.join("&"));
    } catch {
      /* file:// may block */
    }
  }, [mode, region, compare]);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  const dataset = snapshot.datasets[mode];
  const copy = modeCopy[mode];
  const kpis = snapshot.kpis;

  const deltaLabel = mode === "years" ? "YoY" : mode === "months" ? "MoM" : "WoW";
  const last = dataset.points[dataset.points.length - 1];
  const prev = dataset.points[dataset.points.length - 2];
  const airDelta = fmtDelta(last.co2Ppm - prev.co2Ppm);
  const earthDelta = fmtDelta(last.tempAnomalyC - prev.tempAnomalyC);
  const oceanDelta = fmtDelta(last.seaLevelMmVs2000 - prev.seaLevelMmVs2000);

  const regionList = useMemo(() => {
    const list = (snapshot.regions[region] || []).map((r) => ({
      item: r,
      search: (r.name + " " + r.metric + " " + r.sub).toLowerCase(),
    }));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return list.filter((r) => r.search.indexOf(q) !== -1);
    }
    return list;
  }, [snapshot.regions, region, query]);

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
              +{kpis.warmingCvsPreIndustrial.toFixed(2)}°C
            </span>
            <span className="lbl">warming rate</span>
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
              {kpis.co2Ppm.toFixed(1)}
              <span className="unit">ppm CO₂</span>
            </div>
            <div className="kpi-sub">
              <span>Methane CH₄</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {kpis.ch4Ppb.toLocaleString("en-US")}{" "}
                <Term word="ppb">Parts per billion — like ppm but 1,000× smaller.</Term>
              </span>
            </div>
            <p className="kpi-matters">CO₂ traps heat for centuries — what we emit today sets the weather of 2100.</p>
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
              +{kpis.tempAnomalyC.toFixed(2)}
              <span className="unit">°C</span>
            </div>
            <div className="kpi-sub">
              <span>
                {kpis.latestMonthLabel ? kpis.latestMonthLabel + " " : "Land surface "}
                <Term word="anomaly">A difference measured against a reference average, not an actual temperature.</Term>
                {!kpis.latestMonthLabel && " · Jul peak"}
              </span>
            </div>
            <p className="kpi-matters">Averages hide extremes — heatwaves now reach temperatures whole regions have never seen.</p>
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
              {(kpis.seaLevelMmVs2000 >= 0 ? "+" : "") + kpis.seaLevelMmVs2000.toFixed(1)}
              <span className="unit">mm</span>
            </div>
            <div className="kpi-sub">
              <span>Sea level rise vs. 2000</span>
              <span className="tag">
                <Term word="SST">Sea surface temperature.</Term> elevated
              </span>
            </div>
            <p className="kpi-matters">Higher seas push storm surges further inland than at any point in recorded history.</p>
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
            <p className="kpi-matters">Per kilogram these gases trap thousands of times more heat than CO₂.</p>
          </div>
        </section>

        <section className="stage" data-od-id="main-stage">
          <div className="card chart-card" data-od-id="chart-panel">
            <div className="chart-head">
              <div>
                <h2 className="chart-title" id="chart-title">
                  {CHART_TITLE}
                </h2>
                <p className="chart-subtitle" id="chart-subtitle">
                  {copy.sub}
                </p>
              </div>
              <div className="toolbar-tools">
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
                <label className="select-wrap select-sm" aria-label="Temporal range" data-od-id="temporal-switcher">
                  <select id="range-select" value={mode} onChange={(e) => setMode(e.target.value as TemporalMode)}>
                    {TEMPORAL_MODES.map((m) => (
                      <option key={m.mode} value={m.mode}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="select-wrap select-sm" aria-label="Compare region temperature">
                  <select
                    id="compare-select"
                    value={compare}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCompare(v);
                      showToast(v ? "Comparing with " + v : "Compare off");
                    }}
                  >
                    <option value="">No compare</option>
                    {Object.keys(COMPARE_FACTORS).map((r) => (
                      <option key={r} value={r}>
                        {"vs " + r}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="tool-btn"
                  id="play-btn"
                  title="Animate the trend from start to today"
                  onClick={() => setPlaySignal((s) => s + 1)}
                >
                  ▶ Play trend
                </button>
              </div>
            </div>

              <ClimateChart
                mode={mode}
                dataset={dataset}
                compare={compare}
                playSignal={playSignal}
                focusRequest={focusReq}
                hoveredMetric={hoveredMetric}
                onHoverMetric={setHoveredMetric}
              />

              {(() => {
                const items = dataset.points
                  .map((p, i) => ({ i, label: p.label, ev: p.event }))
                  .filter((x) => x.ev);
                const live = snapshot.extraEvents.map((ev, k) => ({
                  key: "live-" + k,
                  label: new Date(ev.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
                  ev: ev.title,
                  focus: snapshot.eventFocus["live-" + k] ?? null,
                }));
                if (!items.length && !live.length)
                  return (
                    <div className="event-strip">
                      <span className="axis-label">No marked events in this window</span>
                    </div>
                  );
                return (
                  <div className="event-strip" aria-label="Events in this range">
                    {items.map((it) => (
                      <button
                        key={it.i}
                        type="button"
                        className="event-chip"
                        onClick={() => setFocusReq({ i: it.i, n: (focusReq?.n ?? 0) + 1 })}
                      >
                        <b>{it.label}</b>
                        {it.ev}
                      </button>
                    ))}
                    {live.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        className="event-chip live-chip"
                        title={it.label + " · NASA EONET"}
                        onClick={() => {
                          if (it.focus != null) setFocusReq({ i: it.focus, n: (focusReq?.n ?? 0) + 1 });
                          showToast(it.ev);
                        }}
                      >
                        <b>{it.label}</b>
                        {it.ev}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="chart-note">
              <span id="chart-sources">
                {snapshot.liveSources.length
                  ? "Live: " + snapshot.liveSources.join(" · ")
                  : "Sources: NOAA GML · NASA GISTEMP · NOAA SLR · demo data"}
              </span>
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
                {snapshot.pollutants.map((p) => {
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
                        <span className={"delta " + badgeCls}>{arrow}</span>{" "}
                        <NoteWithTerm note={p.note} word={p.termWord} def={p.termDef} />
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
            {snapshot.liveSources.length ? "LIVE" : "DEMO"} · updated {snapshot.updatedAt}
          </span>
          <span>
            {snapshot.liveSources.length
              ? "Live sources: " + snapshot.liveSources.join(", ")
              : "Sources: NOAA · NASA GISS · ESA CCI · prototype estimates for evaluation"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>Dataset: 27yr annual · 60mo · 120d</span>
        </div>
      </footer>
      <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
