import ClimateChart from "../ClimateChart";
import { COMPARE_FACTORS } from "../../domain/climate";
import type { ClimateDataset, TemporalMode } from "../../domain/climate";
import type { EditorialChip, LiveChip } from "./events";
import EventStrip from "./EventStrip";
import { CHART_TITLE, TEMPORAL_MODES, modeCopy } from "./content";

type Props = {
  mode: TemporalMode;
  dataset: ClimateDataset;
  compare: string;
  onModeChange: (m: TemporalMode) => void;
  onCompareChange: (c: string) => void;
  onPlay: () => void;
  playSignal: number;
  focusRequest: { i: number; n: number } | null;
  onFocusPoint: (i: number) => void;
  chips: { editorial: EditorialChip[]; live: LiveChip[] };
  liveSources: string[];
  showToast: (msg: string) => void;
};

export default function ChartPanel({
  mode,
  dataset,
  compare,
  onModeChange,
  onCompareChange,
  onPlay,
  playSignal,
  focusRequest,
  onFocusPoint,
  chips,
  liveSources,
  showToast,
}: Props) {
  const copy = modeCopy[mode];

  return (
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
              Y-axis: each line is scaled 0–100 to its own min/max over the range shown — index = (value − min) / (max −
              min) × 100. This makes trend shape comparable across °C, ppm and mm, since they don't share a real unit.
              Hover the chart to see the actual value at any point.
            </span>
          </span>
          <label className="select-wrap select-sm" aria-label="Temporal range" data-od-id="temporal-switcher">
            <select id="range-select" value={mode} onChange={(e) => onModeChange(e.target.value as TemporalMode)}>
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
                onCompareChange(v);
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
          <button type="button" className="tool-btn" id="play-btn" title="Animate the trend from start to today" onClick={onPlay}>
            ▶ Play trend
          </button>
        </div>
      </div>

      <ClimateChart mode={mode} dataset={dataset} compare={compare} playSignal={playSignal} focusRequest={focusRequest} />

      <EventStrip editorial={chips.editorial} live={chips.live} onFocusPoint={onFocusPoint} onToast={showToast} />

      <div className="chart-note">
        <span id="chart-sources">
          {liveSources.length ? "Live: " + liveSources.join(" · ") : "Sources: NOAA GML · NASA GISTEMP · NOAA SLR · demo data"}
        </span>
        <span id="chart-mode-note">{copy.note}</span>
      </div>
    </div>
  );
}
