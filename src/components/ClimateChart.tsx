import { useEffect, useId, useMemo, useRef, useState } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath, AreaClosed } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { localPoint } from "@visx/event";
import { motion, AnimatePresence } from "framer-motion";
import type { ClimateDataset, ClimatePoint, TemporalMode } from "../mock/climateData";

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
  hoveredMetric = null,
  onHoverMetric,
}: {
  mode: TemporalMode;
  dataset: ClimateDataset;
  hoveredMetric?: MetricKey | null;
  onHoverMetric?: (metric: MetricKey | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const gradUid = useId();

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
    const pts: ChartPoint[] = dataset.points.concat(dataset.projection).map((p, i) => ({ ...p, idx: i }));
    const n = pts.length;
    const W = width || 760;
    const H = 340;
    const padL = 28,
      padR = 108,
      padT = 22,
      padB = 30;
    const pw = W - padL - padR,
      ph = H - padT - padB;

    const temps = pts.map((p) => p.temp);
    const co2s = pts.map((p) => p.co2);
    const sls = pts.map((p) => p.sl);

    const tempScale = scaleLinear<number>({ domain: [Math.min(...temps), Math.max(...temps)], range: [0, 100] });
    const co2Scale = scaleLinear<number>({ domain: [Math.min(...co2s), Math.max(...co2s)], range: [0, 100] });
    const slScale = scaleLinear<number>({ domain: [Math.min(...sls), Math.max(...sls)], range: [0, 100] });

    const xScale = scaleLinear<number>({ domain: [0, Math.max(n - 1, 1)], range: [padL, padL + pw] });
    const yScale = scaleLinear<number>({ domain: [0, 100], range: [padT + ph, padT] });

    const X = (i: number) => xScale(i);
    const Ytemp = (p: ChartPoint) => yScale(tempScale(p.temp));
    const Yco2 = (p: ChartPoint) => yScale(co2Scale(p.co2));
    const Ysl = (p: ChartPoint) => yScale(slScale(p.sl));

    return { pts, n, W, H, padL, padR, padT, padB, pw, ph, tempScale, co2Scale, slScale, X, Ytemp, Yco2, Ysl, yScale };
  }, [dataset, width]);

  const { pts, n, W, H, padL, padR, padT, pw, ph, tempScale, X, Ytemp, Yco2, Ysl, yScale } = geo;

  const gridLines = [0, 25, 50, 75, 100].map((v) => yScale(v));

  const labelCount = n > 40 ? 6 : n > 20 ? 7 : 6;
  const xLabels: { x: number; label: string }[] = [];
  for (let li = 0; li < labelCount; li++) {
    const idx = Math.round((li / (labelCount - 1)) * (n - 1));
    xLabels.push({ x: X(idx), label: pts[idx]?.label ?? "" });
  }

  const realPts = pts.slice(0, dataset.points.length);
  const projPts = dataset.projection.length ? pts.slice(dataset.points.length - 1) : [];

  const dailyPath = dataset.daily
    ? pathStr(realPts.map((p) => X(p.idx)), realPts.map((p) => yScale(tempScale(p.daily ?? p.temp))))
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
  const endLabels: { key: MetricKey; x: number; trueY: number; labelY: number; color: string; text: string }[] = [
    { key: "temp" as const, x: X(lastReal), trueY: Ytemp(pts[lastReal]), labelY: 0, color: METRIC_COLOR.temp, text: "+" + pts[lastReal].temp.toFixed(2) + "°C" },
    { key: "co2" as const, x: X(lastReal), trueY: Yco2(pts[lastReal]), labelY: 0, color: METRIC_COLOR.co2, text: pts[lastReal].co2.toFixed(1) + " ppm" },
    { key: "sl" as const, x: X(lastReal), trueY: Ysl(pts[lastReal]), labelY: 0, color: METRIC_COLOR.sl, text: "+" + pts[lastReal].sl.toFixed(1) + " mm" },
  ].sort((a, b) => a.trueY - b.trueY);
  endLabels.forEach((l) => (l.labelY = l.trueY));
  const MIN_LABEL_GAP = 15;
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].labelY - endLabels[i - 1].labelY < MIN_LABEL_GAP) {
      endLabels[i].labelY = endLabels[i - 1].labelY + MIN_LABEL_GAP;
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = (e.target as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const point = localPoint(svg, e);
    const rect = svg.getBoundingClientRect();
    const x = point ? point.x * (W / rect.width) : 0;
    let i = Math.round(((x - padL) / pw) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const p = pts[i];
    const since = pts[0];
    const co2Delta = ((p.co2 - since.co2) / since.co2) * 100;
    const tempDelta = p.temp - since.temp;
    const slDelta = p.sl - since.sl;
    const dateLabel = p.label + (mode === "years" ? " · annual" : "");

    const px = X(i) * (rect.width / W);
    const py = Ytemp(p) * (rect.height / H);

    setTooltip({ x: px, y: py, point: p, dateLabel, tempDelta, co2Delta, slDelta });

    if (onHoverMetric) {
      const cursorY = point ? point.y * (H / rect.height) : Ytemp(p);
      const dists: [MetricKey, number][] = [
        ["temp", Math.abs(cursorY - Ytemp(p))],
        ["co2", Math.abs(cursorY - Yco2(p))],
        ["sl", Math.abs(cursorY - Ysl(p))],
      ];
      dists.sort((a, b) => a[1] - b[1]);
      onHoverMetric(dists[0][0]);
    }
  }

  function handleMouseLeave() {
    setTooltip(null);
    onHoverMetric?.(null);
  }

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

  function opacityFor(metric: MetricKey) {
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
      <svg id="chart-svg" role="img" aria-label="Temperature, CO2 and sea level trends, indexed for comparison" viewBox={`0 0 ${W} ${H}`}>
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
              key={mode + "-sl"}
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
            style={{ opacity: opacityFor("sl") }}
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
              key={mode + "-co2"}
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
            style={{ opacity: opacityFor("co2") }}
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
              key={mode + "-temp"}
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
        {projPts.length > 0 && (
          <path
            className="series-temp projection"
            style={{ opacity: opacityFor("temp") }}
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
          onMouseLeave={handleMouseLeave}
        />
      </svg>
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
              <span className="tt-val">+{tooltip.point.temp.toFixed(2)}°C</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">
                <i style={{ background: "var(--accent)" }} />
                CO₂
              </span>
              <span className="tt-val">{tooltip.point.co2.toFixed(1)} ppm</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">
                <i style={{ background: "var(--success)" }} />
                Sea level
              </span>
              <span className="tt-val">+{tooltip.point.sl.toFixed(1)} mm</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">vs. 2000</span>
              <span className="tt-delta">
                {tooltip.tempDelta >= 0 ? "+" : ""}
                {tooltip.tempDelta.toFixed(2)}°C · {tooltip.co2Delta >= 0 ? "+" : ""}
                {tooltip.co2Delta.toFixed(1)}% CO₂ · +{tooltip.slDelta.toFixed(1)} mm
              </span>
            </div>
            {tooltip.point.event && <div className="tt-event show">◈ {tooltip.point.event}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
