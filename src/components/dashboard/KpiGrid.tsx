import type { ReactNode } from "react";
import type { ClimatePoint, Kpis } from "../../domain/climate";
import { Term } from "../ui/Term";

function fmtDelta(d: number) {
  const cls = Math.abs(d) < 1e-9 ? "flat" : d > 0 ? "up" : "down";
  const sign = d > 0 ? "+" : "";
  return { cls, text: sign + d.toFixed(2) };
}

type KpiCardProps = {
  odId: string;
  deltaId: string;
  category: string;
  accentVar: string;
  deltaCls?: string;
  deltaText?: string;
  deltaUnit?: string;
  deltaLbl: string;
  value: ReactNode;
  sub: ReactNode;
  note: string;
};

function KpiCard({ odId, deltaId, category, accentVar, deltaCls = "", deltaText, deltaUnit, deltaLbl, value, sub, note }: KpiCardProps) {
  return (
    <div className="card kpi" data-od-id={odId}>
      <div className="card-head">
        <span className="card-title">
          <span className="cat" style={{ background: accentVar }} />
          {category}
        </span>
        <span className={"delta " + deltaCls} id={deltaId}>
          {deltaText != null && (
            <>
              <span className="range-lbl">{deltaLbl}</span> {deltaText}
              {deltaUnit}
            </>
          )}
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
      <p className="kpi-matters">{note}</p>
    </div>
  );
}

export default function KpiGrid({ kpis, points, deltaLabel }: { kpis: Kpis; points: ClimatePoint[]; deltaLabel: string }) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const deltaOf = (get: (p: ClimatePoint) => number) => fmtDelta(get(last) - get(prev));

  const airDelta = deltaOf((p) => p.co2Ppm);
  const earthDelta = deltaOf((p) => p.tempAnomalyC);
  const oceanDelta = deltaOf((p) => p.seaLevelMmVs2000);

  return (
    <section className="kpi-grid" data-od-id="summary-cards" aria-label="Summary indicators">
      <KpiCard
        odId="kpi-air"
        deltaLbl={deltaLabel}
        deltaId="air-delta"
        category="Air"
        accentVar="var(--accent)"
        deltaCls={airDelta.cls}
        deltaText={airDelta.text}
        deltaUnit=" ppm"
        value={
          <>
            {kpis.co2Ppm.toFixed(1)}
            <span className="unit">ppm CO₂</span>
          </>
        }
        sub={
          <>
            <span>Methane CH₄</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {kpis.ch4Ppb.toLocaleString("en-US")}{" "}
              <Term word="ppb">Parts per billion — like ppm but 1,000× smaller.</Term>
            </span>
          </>
        }
        note="CO₂ traps heat for centuries — what we emit today sets the weather of 2100."
      />

      <KpiCard
        odId="kpi-earth"
        deltaLbl={deltaLabel}
        deltaId="earth-delta"
        category="Earth"
        accentVar="var(--danger)"
        deltaCls={earthDelta.cls}
        deltaText={earthDelta.text}
        deltaUnit="°C"
        value={
          <>
            +{kpis.tempAnomalyC.toFixed(2)}
            <span className="unit">°C</span>
          </>
        }
        sub={
          <span>
            {kpis.latestMonthLabel ? kpis.latestMonthLabel + " " : "Land surface "}
            <Term word="anomaly">A difference measured against a reference average, not an actual temperature.</Term>
            {!kpis.latestMonthLabel && " · Jul peak"}
          </span>
        }
        note="Averages hide extremes — heatwaves now reach temperatures whole regions have never seen."
      />

      <KpiCard
        odId="kpi-ocean"
        deltaLbl={deltaLabel}
        deltaId="ocean-delta"
        category="Ocean"
        accentVar="var(--success)"
        deltaCls={oceanDelta.cls}
        deltaText={oceanDelta.text}
        deltaUnit=" mm"
        value={
          <>
            {(kpis.seaLevelMmVs2000 >= 0 ? "+" : "") + kpis.seaLevelMmVs2000.toFixed(1)}
            <span className="unit">mm</span>
          </>
        }
        sub={
          <>
            <span>Sea level rise vs. 2000</span>
            <span className="tag">
              <Term word="SST">Sea surface temperature.</Term> elevated
            </span>
          </>
        }
        note="Higher seas push storm surges further inland than at any point in recorded history."
      />

      <KpiCard
        odId="kpi-super"
        deltaLbl={deltaLabel}
        deltaId="super-delta"
        category="Super Pollutants"
        accentVar="var(--warn)"
        deltaCls={
          kpis.fGasForcingDeltaPct == null ? "up" : kpis.fGasForcingDeltaPct < -0.05 ? "down" : "up"
        }
        deltaText={kpis.fGasForcingDeltaPct == null ? "+4.3%" : (kpis.fGasForcingDeltaPct >= 0 ? "+" : "") + kpis.fGasForcingDeltaPct.toFixed(1) + "%"}
        value={
          <>
            HFCs<span className="unit">+ SF₆</span>
          </>
        }
        sub={<span>Fluorinated gases · share of non-CO₂ forcing</span>}
        note="Per kilogram these gases trap thousands of times more heat than CO₂."
      />
    </section>
  );
}
