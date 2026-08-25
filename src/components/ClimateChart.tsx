import { useEffect, useId, useMemo, useRef, useState } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath, AreaClosed } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { localPoint } from "@visx/event";
import { motion, AnimatePresence } from "framer-motion";
import { COMPARE_FACTORS, type ClimateDataset, type ClimatePoint, type TemporalMode } from "../domain/climate";

function lerpArr(arr: number[], t: number): number {
  if (!arr.length) return 0;
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  const f = t - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

const REDUCED = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type MetricKey = "temp" | "co2" | "sl";

type ChartPoint = ClimatePoint & { projection?: boolean; idx: number };

type TooltipState = {
  x: number;
  y: number;
  point: ChartPoint;
  dateLabel: string;
  tempDelta: number;
  co2Delta: number;
  slDelta: number;
};

function pathStr(x: number[], y: number[]) {
  return x.map((v, i) => (i ? "L" : "M") + v.toFixed(1) + " " + y[i].toFixed(1)).join(" ");
}

const METRIC_COLOR: Record<MetricKey, string> = {
  temp: "var(--danger)",
  co2: "var(--accent)",
  sl: "var(--success)",
};

export default function ClimateChart({
  mode,
  dataset,
  projection,
  compare = "",
  playSignal = 0,
  focusRequest = null,
  hoveredMetric = null,
  onHoverMetric,
}: {
  mode: TemporalMode;
  dataset: ClimateDataset;
  projection?: ClimatePoint[];
  compare?: string | null;
  playSignal?: number;
  focusRequest?: { i: number; n: number } | null;
  hoveredMetric?: MetricKey | null;
  onHoverMetric?: (metric: MetricKey | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(760);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
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
    setWidth(el.clientWidth || 760);
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

    const temps = pts.map((p) => p.tempAnomalyC);
    if (cmpArr) temps.push(...cmpArr);
    const co2s = pts.map((p) => p.co2Ppm);
    const sls = pts.map((p) => p.seaLevelMmVs2000);

    const tempScale = scaleLinear<number>({ domain: [Math.min(...temps), Math.max(...temps)], range: [0, 100] });
    const co2Scale = scaleLinear<number>({ domain: [Math.min(...co2s), Math.max(...co2s)], range: [0, 100] });
    const slScale = scaleLinear<number>({ domain: [Math.min(...sls), Math.max(...sls)], range: [0, 100] });

    const xScale = scaleLinear<number>({ domain: [0, Math.max(n - 1, 1)], range: [padL, padL + pw] });
    const yScale = scaleLinear<number>({ domain: [0, 100], range: [padT + ph, padT] });

    const X = (i: number) => xScale(i);
    const Ytemp = (p: ChartPoint) => yScale(tempScale(p.tempAnomalyC));
    const Yco2 = (p: ChartPoint) => yScale(co2Scale(p.co2Ppm));
    const Ysl = (p: ChartPoint) => yScale(slScale(p.seaLevelMmVs2000));

    return { pts, n, cmpArr, W, H, padL, padR, padT, padB, pw, ph, tempScale, co2Scale, slScale, X, Ytemp, Yco2, Ysl, yScale };
  }, [dataset, projData, width, compare]);

  const { pts, n, cmpArr, W, H, padL, padR, padT, pw, ph, tempScale, co2Scale, slScale, X, Ytemp, Yco2, Ysl, yScale } = geo;

  const gridLines = [50].map((v) => yScale(v));

  const labelCount = n > 40 ? 6 : n > 20 ? 7 : 6;
  const xLabels: { x: number; label: string }[] = [];
  for (let li = 0; li < labelCount; li++) {
    const idx = Math.round((li / (labelCount - 1)) * (n - 1));
    xLabels.push({ x: X(idx), label: pts[idx]?.label ?? "" });
  }

  const realPts = pts.slice(0, dataset.points.length);
  const projPts = projData.length ? pts.slice(dataset.points.length - 1) : [];

  const BAND_FRAC: Record<MetricKey, number> = { temp: 0.09, co2: 0.055, sl: 0.2 };
  function bandPath(getNorm: (p: ChartPoint) => number, frac: number): string | null {
    if (projPts.length < 2) return null;
    const up: string[] = [];
    const dn: string[] = [];
    projPts.forEach((p, i) => {
      const off = 100 * frac * (i / (projPts.length - 1));
      const yt = yScale(Math.min(100, getNorm(p) + off));
      const yb = yScale(Math.max(0, getNorm(p) - off));
      up.push((i ? "L" : "M") + X(p.idx).toFixed(1) + " " + yt.toFixed(1));
      dn.unshift("L" + X(p.idx).toFixed(1) + " " + yb.toFixed(1));
    });
    return up.join(" ") + " " + dn.join(" ") + " Z";
  }
  const bandPaths: { key: MetricKey; d: string | null }[] = [
    { key: "temp", d: bandPath((p) => tempScale(p.tempAnomalyC), BAND_FRAC.temp) },
    { key: "co2", d: bandPath((p) => co2Scale(p.co2Ppm), BAND_FRAC.co2) },
    { key: "sl", d: bandPath((p) => slScale(p.seaLevelMmVs2000), BAND_FRAC.sl) },
  ];

  const dailyPath = dataset.daily
    ? pathStr(realPts.map((p) => X(p.idx)), realPts.map((p) => yScale(tempScale(p.dailyTempAnomalyC ?? p.tempAnomalyC))))
    : null;

  const eventMarkers = pts
    .filter((p) => p.event)
    .map((p) => {
      const ex = X(p.idx);
      const ey = Ytemp(p);
      return `M${ex} ${ey - 5} L${ex + 5} ${ey} L${ex} ${ey + 5} L${ex - 5} ${ey} Z`;
    });

  let thresholdY: number | null = null;
  if (dataset.threshold) {
    const [tMin, tMax] = tempScale.domain() as [number, number];
    if (1.5 >= tMin && 1.5 <= tMax) thresholdY = yScale(tempScale(1.5));
  }

  const lastReal = dataset.points.length - 1;
  const endLabels: { key: string; x: number; trueY: number; labelY: number; color: string; text: string }[] = [
    { key: "temp", x: X(lastReal), trueY: Ytemp(pts[lastReal]), labelY: 0, color: METRIC_COLOR.temp, text: "+" + pts[lastReal].tempAnomalyC.toFixed(2) + "°C" },
    { key: "co2", x: X(lastReal), trueY: Yco2(pts[lastReal]), labelY: 0, color: METRIC_COLOR.co2, text: pts[lastReal].co2Ppm.toFixed(1) + " ppm" },
    { key: "sl", x: X(lastReal), trueY: Ysl(pts[lastReal]), labelY: 0, color: METRIC_COLOR.sl, text: "+" + pts[lastReal].seaLevelMmVs2000.toFixed(1) + " mm" },
  ];
  if (cmpArr) {
    endLabels.push({
      key: "cmp",
      x: X(lastReal),
      trueY: yScale(tempScale(cmpArr[lastReal])),
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
    const co2Delta = ((p.co2Ppm - since.co2Ppm) / since.co2Ppm) * 100;
    const tempDelta = p.tempAnomalyC - since.tempAnomalyC;
    const slDelta = p.seaLevelMmVs2000 - since.seaLevelMmVs2000;
    const dateLabel = p.label + (mode === "years" ? " · annual" : "");

    const rect = svgRef.current?.getBoundingClientRect();
    const px = X(idx) * ((rect?.width ?? W) / W);
    const py = Ytemp(p) * ((rect?.height ?? H) / H);

    setTooltip({ x: px, y: py, point: p, dateLabel, tempDelta, co2Delta, slDelta });

    if (onHoverMetric) {
      const cy = cursorY ?? Ytemp(p);
      const dists: [MetricKey, number][] = [
        ["temp", Math.abs(cy - Ytemp(p))],
        ["co2", Math.abs(cy - Yco2(p))],
        ["sl", Math.abs(cy - Ysl(p))],
      ];
      dists.sort((a, b) => a[1] - b[1]);
      onHoverMetric(dists[0][0]);
    }
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
    onHoverMetric?.(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === "Escape") {
      clearHover();
      return;
    }
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -1e9 : e.key === "End" ? 1e9 : 0;
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

  const tempGradId = `temp-grad-${gradUid}`;
  const co2GradId = `co2-grad-${gradUid}`;
  const slGradId = `sl-grad-${gradUid}`;

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
        <LinearGradient id={tempGradId} from={METRIC_COLOR.temp} to={METRIC_COLOR.temp} fromOpacity={0.16} toOpacity={0} vertical />
        <LinearGradient id={co2GradId} from={METRIC_COLOR.co2} to={METRIC_COLOR.co2} fromOpacity={0.14} toOpacity={0} vertical />
        <LinearGradient id={slGradId} from={METRIC_COLOR.sl} to={METRIC_COLOR.sl} fromOpacity={0.16} toOpacity={0} vertical />

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

        {hoverIndex >= 0 && (
          <line className="hover-line" x1={X(hoverIndex)} x2={X(hoverIndex)} y1={padT} y2={padT + ph} />
        )}

        {bandPaths.map(
          (b) =>
            b.d && (
              <path
                key={"band-" + b.key}
                className={"band band-" + b.key}
                d={b.d}
                fill={METRIC_COLOR[b.key]}
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

        {/* sea level */}
        <AreaClosed<ChartPoint>
          data={realPts}
          x={(p) => X(p.idx)}
          y={(p) => Ysl(p)}
          yScale={yScale}
          curve={curveMonotoneX}
          fill={`url(#${slGradId})`}
          style={{ transition: "opacity 150ms ease", opacity: opacityFor("sl") }}
        />
        <LinePath<ChartPoint> data={realPts} x={(p) => X(p.idx)} y={(p) => Ysl(p)} curve={curveMonotoneX}>
          {({ path }) => (
            <motion.path
              key={mode + "-sl" + (replay ? "-r" + replay : "")}
              d={path(realPts) || ""}
              fill="none"
              stroke={METRIC_COLOR.sl}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1, opacity: opacityFor("sl"), strokeWidth: strokeWidthFor("sl", 2.2) }}
              transition={{ pathLength: { duration: 0.6, ease: "easeOut" }, default: { duration: 0.15 } }}
            />
          )}
        </LinePath>
        {projPts.length > 0 && (
          <path
            className="series-sl projection"
            style={{ opacity: revealed ? opacityFor("sl") : 0 }}
            d={pathStr(projPts.map((p) => X(p.idx)), projPts.map((p) => Ysl(p)))}
          />
        )}

        {/* co2 */}
        <AreaClosed<ChartPoint>
          data={realPts}
          x={(p) => X(p.idx)}
          y={(p) => Yco2(p)}
          yScale={yScale}
          curve={curveMonotoneX}
          fill={`url(#${co2GradId})`}
          style={{ transition: "opacity 150ms ease", opacity: opacityFor("co2") }}
        />
        <LinePath<ChartPoint> data={realPts} x={(p) => X(p.idx)} y={(p) => Yco2(p)} curve={curveMonotoneX}>
          {({ path }) => (
            <motion.path
              key={mode + "-co2" + (replay ? "-r" + replay : "")}
              d={path(realPts) || ""}
              fill="none"
              stroke={METRIC_COLOR.co2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1, opacity: opacityFor("co2"), strokeWidth: strokeWidthFor("co2", 2.2) }}
              transition={{ pathLength: { duration: 0.6, ease: "easeOut", delay: 0.05 }, default: { duration: 0.15 } }}
            />
          )}
        </LinePath>
        {projPts.length > 0 && (
          <path
            className="series-co2 projection"
            style={{ opacity: revealed ? opacityFor("co2") : 0 }}
            d={pathStr(projPts.map((p) => X(p.idx)), projPts.map((p) => Yco2(p)))}
          />
        )}

        {dailyPath && <path className="series-daily" d={dailyPath} style={{ opacity: opacityFor("temp") }} />}

        {/* temp anomaly */}
        <AreaClosed<ChartPoint>
          data={realPts}
          x={(p) => X(p.idx)}
          y={(p) => Ytemp(p)}
          yScale={yScale}
          curve={curveMonotoneX}
          fill={`url(#${tempGradId})`}
          style={{ transition: "opacity 150ms ease", opacity: opacityFor("temp") }}
        />
        <LinePath<ChartPoint> data={realPts} x={(p) => X(p.idx)} y={(p) => Ytemp(p)} curve={curveMonotoneX}>
          {({ path }) => (
            <motion.path
              key={mode + "-temp" + (replay ? "-r" + replay : "")}
              d={path(realPts) || ""}
              fill="none"
              stroke={METRIC_COLOR.temp}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1, opacity: opacityFor("temp"), strokeWidth: strokeWidthFor("temp", 2.2) }}
              transition={{ pathLength: { duration: 0.6, ease: "easeOut", delay: 0.1 }, default: { duration: 0.15 } }}
            />
          )}
        </LinePath>

        {cmpArr && (
          <path
            className="series-compare"
            style={{ opacity: revealed ? opacityFor("temp") : 0, transition: "opacity 150ms ease" }}
            d={pathStr(
              pts.map((_, i) => X(i)),
              cmpArr.map((v) => yScale(tempScale(v))),
            )}
          />
        )}

        {projPts.length > 0 && (
          <path
            className="series-temp projection"
            style={{ opacity: revealed ? opacityFor("temp") : 0 }}
            d={pathStr(projPts.map((p) => X(p.idx)), projPts.map((p) => Ytemp(p)))}
          />
        )}
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
              <th>Temp anomaly °C</th>
              <th>CO₂ ppm</th>
              <th>Sea level mm</th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                <td>+{p.tempAnomalyC.toFixed(2)}</td>
                <td>{p.co2Ppm.toFixed(1)}</td>
                <td>+{p.seaLevelMmVs2000.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="tooltip"
            className="tooltip"
            style={tooltipStyle}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="tt-date">{tooltip.dateLabel}</div>
            <div className="tt-row">
              <span className="tt-key">
                <i style={{ background: "var(--danger)" }} />
                Temp anomaly
              </span>
              <span className="tt-val">+{tooltip.point.tempAnomalyC.toFixed(2)}°C</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">
                <i style={{ background: "var(--accent)" }} />
                CO₂
              </span>
              <span className="tt-val">{tooltip.point.co2Ppm.toFixed(1)} ppm</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">
                <i style={{ background: "var(--success)" }} />
                Sea level
              </span>
              <span className="tt-val">+{tooltip.point.seaLevelMmVs2000.toFixed(1)} mm</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">vs. 2000</span>
              <span className="tt-delta">
                {tooltip.tempDelta >= 0 ? "+" : ""}
                {tooltip.tempDelta.toFixed(2)}°C · {tooltip.co2Delta >= 0 ? "+" : ""}
                {tooltip.co2Delta.toFixed(1)}% CO₂ · +{tooltip.slDelta.toFixed(1)} mm
              </span>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
