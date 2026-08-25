import { regionNames, type RegionName } from "../../domain/climate";

type Props = {
  region: RegionName;
  onRegionChange: (r: RegionName) => void;
  query: string;
  onQueryChange: (q: string) => void;
  warmingCvsPreIndustrial: number;
};

export default function DashboardHeader({ region, onRegionChange, query, onQueryChange, warmingCvsPreIndustrial }: Props) {
  return (
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
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>

        <div className="select-wrap" data-od-id="region-selector">
          <select
            id="region-select"
            aria-label="Region"
            value={region}
            onChange={(e) => onRegionChange(e.target.value as RegionName)}
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
            +{warmingCvsPreIndustrial.toFixed(2)}°C
          </span>
          <span className="lbl">warming rate</span>
        </div>
      </div>
    </header>
  );
}
