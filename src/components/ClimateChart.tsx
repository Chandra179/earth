import { useEffect, useId, useMemo, useRef, useState } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath, AreaClosed } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { localPoint } from "@visx/event";
import { COMPARE_FACTORS, type ClimateDataset, type ClimatePoint, type TemporalMode } from "../domain/climate";
import { METRIC_BY_KEY, METRICS, type MetricKey } from "./metrics";

function lerpArr(arr: number[], t: number): number {
  if (!arr.length) return arr[0] ?? 0;
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  const f = t - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

const REDUCED =
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type ChartPoint = ClimatePoint & { idx: number };

type TooltipState = {
  x: number;
  y: number;
  point: ChartPoint;
  dateLabel: string;
  deltas: string;
};

function pathStr(x: number[], y: number[]) {
  return x.map((v, i) => (i ? "L" : "M") + v.toFixed(1) + " " + y[i].toFixed(1)).join(" ");
}

export default function ClimateChart({
  mode,
  dataset,
  projection,
  compare = "",
  playSignal = 0,
  focusRequest = null,
}: {
  mode: TemporalMode;
  dataset: ClimateDataset;
  projection?: ClimatePoint[];
  compare?: string | null;
  playSignal?: number;
  focusRequest?: { i: number; n: number } | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(760);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<MetricKey | null>(null);
  const gradUid = useId();
  const projData = projection ?? dataset.projection;
  const kbIndex = useRef(-1);
  const [replay, setReplay] = useState(0);
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const pts: ChartPoint[] = dataset.points.concat(projData).map((p, i) => ({ ...p, idx: i }));
    const n = pts.length;

    const baseTemps = dataset.points.map((p) => p.tempAnomalyC);
    const cmpArr: number[] | null =
      compare && COMPARE_FACTORS[compare]
        ? pts.map(
            (_, i) =>
              lerpArr(baseTemps, (i / Math.max(n - 1, 1)) * Math.max(baseTemps.length - 1, 0)) *
              COMPARE_FACTORS[compare],
          )
        : null;

    const W = width || 760;
    const H = 340;
    const padL = 28,
      padR = cmpArr ? 136 : 108,
      padT = 22,
      padB = 30;
    const pw = W - padL - padR,
      ph = H - padT - padB;

    const normVal: Record<MetricKey, (v: number) => number> = {} as Record<MetricKey, (v: number) => number>;
    for (const m of METRICS) {
      const vals = pts.map(m.value);
      if (cmpArr && m.key === "temp") vals.push(...cmpArr);
      const scale = scaleLinear<number>({ domain: [Math.min(...vals), Math.max(...vals)], range: [0, 100] });
      normVal[m.key] = (v: number) => scale(v);
    }

    const xScale = scaleLinear<number>({ domain: [0, Math.max(n - 1, 1)], range: [padL, padL + pw] });
    const yScale = scaleLinear<number>({ domain: [0, 100], range: [padT + ph, padT] });

    const X = (i: number) => xScale(i);
    const Y: Record<MetricKey, (p: ChartPoint) => number> = Object.fromEntries(
      METRICS.map((m) => [m.key, (p: ChartPoint) => yScale(normVal[m.key](m.value(p)))]),
    ) as Record<MetricKey, (p: ChartPoint) => number>;

    return { pts, n, cmpArr, W, H, padL, padR, padT, padB, pw, ph, normVal, X, Y, yScale };
  }, [dataset, projData, width, compare]);

  const { pts, n, cmpArr, W, H, padL, padR, padT, pw, ph, normVal, X, Y, yScale } = geo;

  const gridLines = [50].map((v) => yScale(v));

  const labelCount = n > 40 ? 6 : n > 20 ? 7 : 6;
  const xLabels: { x: number; label: string }[] = [];
  for (let li = 0; li < labelCount; li++) {
    const idx = Math.round((li / (labelCount - 1)) * (n - 1));
    xLabels.push({ x: X(idx), label: pts[idx]?.label ?? "" });
  }

  const realPts = pts.slice(0, dataset.points.length);
  const projPts = projData.length ? pts.slice(dataset.points.length - 1) : [];
  const lastReal = dataset.points.length - 1;

  function bandPath(metricKey: MetricKey): string | null {
    if (projPts.length < 2) return null;
    const frac = METRIC_BY_KEY[metricKey].bandFrac;
    const up: string[] = [];
    const dn: string[] = [];
    projPts.forEach((p, i) => {
      const off = 100 * frac * (i / (projPts.length - 1));
      const yt = yScale(Math.min(100, normVal[metricKey](METRIC_BY_KEY[metricKey].value(p)) + off));
      const yb = yScale(Math.max(0, normVal[metricKey](METRIC_BY_KEY[metricKey].value(p)) - off));
      up.push((i ? "L" : "M") + X(p.idx).toFixed(1) + " " + yt.toFixed(1));
      dn.unshift("L" + X(p.idx).toFixed(1) + " " + yb.toFixed(1));
    });
    return up.join(" ") + " " + dn.join(" ") + " Z";
  }
  const bandPaths: { key: MetricKey; d: string | null }[] = METRICS.map((m) => ({ key: m.key, d: bandPath(m.key) }));

  const dailyPath = dataset.daily
    ? pathStr(
        realPts.map((p) => X(p.idx)),
        realPts.map((p) => yScale(normVal.temp(p.dailyTempAnomalyC ?? p.tempAnomalyC))),
      )
    : null;

  const eventMarkers = pts
    .filter((p) => p.event)
    .map((p) => {
      const ex = X(p.idx);
      const ey = Y.temp(p);
      return `M${ex} ${ey - 5} L${ex + 5} ${ey} L${ex} ${ey + 5} L${ex - 5} ${ey} Z`;
    });

  let thresholdY: number | null = null;
  if (dataset.threshold) {
    const tVals = pts.map((p) => p.tempAnomalyC).concat(cmpArr ?? []);
    const tMin = Math.min(...tVals),
      tMax = Math.max(...tVals);
    if (1.5 >= tMin && 1.5 <= tMax) thresholdY = yScale(normVal.temp(1.5));
  }

  const endLabels: { key: string; x: number; trueY: number; labelY: number; color: string; text: string }[] =
    METRICS.map((m) => ({
      key: m.key,
      x: X(lastReal),
      trueY: Y[m.key](pts[lastReal]),
      labelY: 0,
      color: m.color,
      text: m.endLabel(pts[lastReal]),
    }));
  if (cmpArr) {
    endLabels.push({
      key: "cmp",
      x: X(lastReal),
      trueY: yScale(normVal.temp(cmpArr[lastReal])),
      labelY: 0,
      color: "var(--warn)",
      text: compare + " +" + cmpArr[lastReal].toFixed(2) + "°C",
    });
  }
  endLabels.sort((a, b) => a.trueY - b.trueY);
  endLabels.forEach((l) => (l.labelY = l.trueY));
  const MIN_LABEL_GAP = 15;
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].labelY - endLabels[i - 1].labelY < MIN_LABEL_GAP) {
      endLabels[i].labelY = endLabels[i - 1].labelY + MIN_LABEL_GAP;
    }
  }

  function showAt(i: number, cursorY?: number) {
    const idx = Math.max(0, Math.min(n - 1, i));
    const p = pts[idx];
    const since = pts[0];
    const deltas = METRICS.map((m) => m.deltaText(p, since)).join(" · ");
    const dateLabel = p.label + (mode === "years" ? " · annual" : "");

    const rect = svgRef.current?.getBoundingClientRect();
    const px = X(idx) * ((rect?.width ?? W) / W);
    const py = Y.temp(p) * ((rect?.height ?? H) / H);

    setTooltip({ x: px, y: py, point: p, dateLabel, deltas });

    const cy = cursorY ?? Y.temp(p);
    const dists: [MetricKey, number][] = METRICS.map((m) => [m.key, Math.abs(cy - Y[m.key](p))]);
    dists.sort((a, b) => a[1] - b[1]);
    setHoveredMetric(dists[0][0]);
    kbIndex.current = idx;
  }

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const point = localPoint(svg, e);
    const rect = svg.getBoundingClientRect();
    const x = point ? point.x * (W / rect.width) : 0;
    let i = Math.round(((x - padL) / pw) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const cursorY = point ? point.y * (H / rect.height) : undefined;
    showAt(i, cursorY);
  }

  function clearHover() {
    setTooltip(null);
    kbIndex.current = -1;
    setHoveredMetric(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === "Escape") {
      clearHover();
      return;
    }
    const step =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -1e9 : e.key === "End" ? 1e9 : 0;
    if (!step) return;
    e.preventDefault();
    showAt((kbIndex.current < 0 ? 0 : kbIndex.current) + step);
  }

  const showAtRef = useRef(showAt);
  showAtRef.current = showAt;

  useEffect(() => {
    if (!playSignal || REDUCED) return;
    setRevealed(false);
    setReplay((s) => s + 1);
    const t = setTimeout(() => setRevealed(true), 650);
    return () => clearTimeout(t);
  }, [playSignal]);

  useEffect(() => {
    if (!focusRequest) return;
    showAtRef.current(focusRequest.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.n]);

  const tooltipStyle = useMemo(() => {
    if (!tooltip) return undefined;
    const stageEl = stageRef.current;
    const stageW = stageEl?.clientWidth ?? W;
    const tipW = 250;
    let left = tooltip.x + 16;
    if (left + tipW > stageW - 4) left = tooltip.x - tipW - 16;
    let top = tooltip.y - 100 - 12;
    if (top < 4) top = tooltip.y + 16;
    return { left, top };
  }, [tooltip, W]);

  const hoverIndex = tooltip ? pts.indexOf(tooltip.point) : -1;

  function opacityFor(metric: MetricKey | string) {
    return hoveredMetric && hoveredMetric !== metric ? 0.32 : 1;
  }
  function strokeWidthFor(metric: MetricKey, base: number) {
    return hoveredMetric === metric ? base + 1 : base;
  }

  const gradId = (key: MetricKey) => `${key}-grad-${gradUid}`;

  function renderSeries(metricKey: MetricKey, withProjection: boolean) {
    const m = METRIC_BY_KEY[metricKey];
    return (
      <>
        <AreaClosed<ChartPoint>
          data={realPts}
          x={(p) => X(p.idx)}
          y={(p) => Y[metricKey](p)}
          yScale={yScale}
          curve={curveMonotoneX}
          fill={`url(#${gradId(metricKey)})`}
          style={{ transition: "opacity 150ms ease", opacity: opacityFor(metricKey) }}
        />
        <LinePath<ChartPoint> data={realPts} x={(p) => X(p.idx)} y={(p) => Y[metricKey](p)} curve={curveMonotoneX}>
          {({ path }) => (
            <path
              key={mode + "-" + metricKey + (replay ? "-r" + replay : "")}
              d={path(realPts) || ""}
              fill="none"
              stroke={m.color}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              className={!REDUCED ? "series-line-anim" : undefined}
              style={{
                animationDelay: m.drawDelaySec + "s",
                transition: "opacity 150ms ease, stroke-width 150ms ease",
                opacity: opacityFor(metricKey),
                strokeWidth: strokeWidthFor(metricKey, m.strokeWidth),
              }}
            />
          )}
        </LinePath>
        {withProjection && projPts.length > 0 && (
          <path
            className={"series-" + metricKey + " projection"}
            style={{ opacity: revealed ? opacityFor(metricKey) : 0 }}
            d={pathStr(projPts.map((p) => X(p.idx)), projPts.map((p) => Y[metricKey](p)))}
          />
        )}
      </>
    );
  }

  function renderTempProjection() {
    if (projPts.length === 0) return null;
    return (
      <path
        className="series-temp projection"
        style={{ opacity: revealed ? opacityFor("temp") : 0 }}
        d={pathStr(projPts.map((p) => X(p.idx)), projPts.map((p) => Y.temp(p)))}
      />
    );
  }

  return (
    <div className="chart-stage" id="chart-stage" ref={stageRef}>
      <svg
        id="chart-svg"
        ref={svgRef}
        role="img"
        aria-label="Temperature, CO2 and sea level trends, indexed for comparison. Use arrow keys to step through data points."
        viewBox={`0 0 ${W} ${H}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onBlur={clearHover}
      >
        {METRICS.map((m) => (
          <LinearGradient
            key={m.key}
            id={gradId(m.key)}
            from={m.color}
            to={m.color}
            fromOpacity={m.areaFromOpacity}
            toOpacity={0}
            vertical
          />
        ))}

        {gridLines.map((y, i) => (
          <line key={"grid" + i} className="grid-line" x1={padL} x2={W - padR} y1={y} y2={y} />
        ))}
        {xLabels.map((l, i) => (
          <text key={"xlbl" + i} className="axis-label" x={l.x} y={padT + ph + 18} textAnchor="middle">
            {l.label}
          </text>
        ))}

        {thresholdY !== null && (
          <>
            <line className="threshold" x1={padL} x2={W - padR} y1={thresholdY} y2={thresholdY} />
            <text className="threshold-lbl" x={padL + 6} y={thresholdY - 6} textAnchor="start">
              +1.5°C Paris
            </text>
          </>
        )}

        {hoverIndex >= 0 && <line className="hover-line" x1={X(hoverIndex)} x2={X(hoverIndex)} y1={padT} y2={padT + ph} />}

        {bandPaths.map(
          (b) =>
            b.d && (
              <path
                key={"band-" + b.key}
                className={"band band-" + b.key}
                d={b.d}
                fill={METRIC_BY_KEY[b.key].color}
                style={{ opacity: (revealed ? 1 : 0) * 0.12 * opacityFor(b.key), transition: "opacity 150ms ease" }}
              />
            ),
        )}

        {projPts.length > 0 && (
          <>
            <line className="today-line" x1={X(lastReal)} x2={X(lastReal)} y1={padT} y2={padT + ph} />
            <text className="today-lbl" x={X(lastReal)} y={padT - 7} textAnchor="middle">
              today
            </text>
          </>
        )}

        {renderSeries("sl", true)}
        {renderSeries("co2", true)}

        {dailyPath && <path className="series-daily" d={dailyPath} style={{ opacity: opacityFor("temp") }} />}

        {/* temp anomaly renders above the overlays below it, matching prior z-order */}
        {renderSeries("temp", false)}

        {cmpArr && (
          <path
            className="series-compare"
            style={{ opacity: revealed ? opacityFor("temp") : 0, transition: "opacity 150ms ease" }}
            d={pathStr(
              pts.map((_, i) => X(i)),
              cmpArr.map((v) => yScale(normVal.temp(v))),
            )}
          />
        )}

        {renderTempProjection()}
        {eventMarkers.map((d, i) => (
          <path key={"evt" + i} className="event temp" style={{ opacity: opacityFor("temp") }} d={d} />
        ))}

        {endLabels.map((l) => (
          <g key={l.key} style={{ transition: "opacity 150ms ease", opacity: opacityFor(l.key) }}>
            {Math.abs(l.labelY - l.trueY) > 2 && (
              <line x1={l.x} x2={l.x + 6} y1={l.trueY} y2={l.labelY} stroke={l.color} strokeWidth={1} opacity={0.5} />
            )}
            <circle cx={l.x} cy={l.trueY} r={3} fill={l.color} />
            <text x={l.x + 13} y={l.labelY + 3.5} className="axis-label" style={{ fill: l.color, fontWeight: 700 }}>
              {l.text}
            </text>
          </g>
        ))}

        <rect
          className="overlay-rect"
          x={padL}
          y={padT}
          width={pw}
          height={ph}
          onMouseMove={handleMouseMove}
          onMouseLeave={clearHover}
        />
      </svg>

      <div id="sr-table" className="sr-only">
        <table>
          <caption>Climate indicator values for the current range</caption>
          <thead>
            <tr>
              <th>Period</th>
              {METRICS.map((m) => (
                <th key={m.key}>{m.srHeader}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pts.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                {METRICS.map((m) => (
                  <td key={m.key}>{m.srCell(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tooltip && (
        <div key="tooltip" className="tooltip show tt-in" style={tooltipStyle}>
          <div className="tt-date">{tooltip.dateLabel}</div>
          {METRICS.map((m) => (
            <div className="tt-row" key={m.key}>
              <span className="tt-key">
                <i style={{ background: m.color }} />
                {m.tooltipName}
              </span>
              <span className="tt-val">{m.tooltipValue(tooltip.point)}</span>
            </div>
          ))}
          <div className="tt-row">
            <span className="tt-key">vs. 2000</span>
            <span className="tt-delta">{tooltip.deltas}</span>
          </div>
          {cmpArr && (
            <div className="tt-row">
              <span className="tt-key">
                <i style={{ background: "var(--warn)" }} />
                {compare}
              </span>
              <span className="tt-val">+{cmpArr[hoverIndex >= 0 ? hoverIndex : 0].toFixed(2)}°C</span>
            </div>
          )}
          {tooltip.point.event && <div className="tt-event show">◈ {tooltip.point.event}</div>}
        </div>
      )}
    </div>
  );
}
