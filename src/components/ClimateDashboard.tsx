import { useCallback, useState } from "react";
import { COMPARE_FACTORS, regionNames, type RegionName, type TemporalMode } from "../domain/climate";
import { useClimateData } from "../hooks/useClimateData";
import { useUrlState } from "../hooks/useUrlState";
import { Toast } from "./ui/Toast";
import { useToast } from "../hooks/useToast";
import DashboardHeader from "./dashboard/DashboardHeader";
import KpiGrid from "./dashboard/KpiGrid";
import ChartPanel from "./dashboard/ChartPanel";
import { collectEventChips } from "./dashboard/events";
import PollutantBreakdown from "./dashboard/PollutantBreakdown";
import RegionalBreakdown from "./dashboard/RegionalBreakdown";
import DashboardFooter from "./dashboard/DashboardFooter";
import { deltaLabelFor } from "./dashboard/content";

export default function ClimateDashboard() {
  const [mode, setMode] = useState<TemporalMode>("years");
  const [region, setRegion] = useState<RegionName>("Global");
  const [query, setQuery] = useState("");
  const [compare, setCompare] = useState("");
  const [playSignal, setPlaySignal] = useState(0);
  const [focusReq, setFocusReq] = useState<{ i: number; n: number } | null>(null);
  const { snapshot } = useClimateData();
  const { message: toastMessage, show: showToast } = useToast();

  useUrlState(
    (h) => {
      const hm = h.get("mode");
      if (hm && snapshot.datasets[hm as TemporalMode]) setMode(hm as TemporalMode);
      const hr = h.get("region");
      if (hr && (regionNames as readonly string[]).includes(hr)) setRegion(hr as RegionName);
      const hc = h.get("compare");
      if (hc && COMPARE_FACTORS[hc]) setCompare(hc);
    },
    () => {
      const parts = ["mode=" + mode, "region=" + encodeURIComponent(region)];
      if (compare) parts.push("compare=" + encodeURIComponent(compare));
      return parts.join("&");
    },
    [mode, region, compare],
  );

  const requestFocus = useCallback((i: number) => {
    setFocusReq((prev) => ({ i, n: (prev?.n ?? 0) + 1 }));
  }, []);

  const dataset = snapshot.datasets[mode];

  return (
    <>
      <DashboardHeader
        region={region}
        onRegionChange={setRegion}
        query={query}
        onQueryChange={setQuery}
        warmingCvsPreIndustrial={snapshot.kpis.warmingCvsPreIndustrial}
      />

      <main className="shell page" id="content">
        <KpiGrid kpis={snapshot.kpis} points={dataset.points} deltaLabel={deltaLabelFor(mode)} />

        <section className="stage" data-od-id="main-stage">
          <ChartPanel
            chips={collectEventChips(dataset, snapshot.extraEvents)}
            mode={mode}
            dataset={dataset}
            compare={compare}
            onModeChange={setMode}
            onCompareChange={setCompare}
            onPlay={() => setPlaySignal((s) => s + 1)}
            playSignal={playSignal}
            focusRequest={focusReq}
            onFocusPoint={requestFocus}
            liveSources={snapshot.liveSources}
            showToast={showToast}
          />

          <aside className="side-stack" data-od-id="side-panel">
            <PollutantBreakdown pollutants={snapshot.pollutants} />
            <RegionalBreakdown region={region} rows={snapshot.regions[region] ?? []} query={query} />
          </aside>
        </section>
      </main>

      <DashboardFooter liveSources={snapshot.liveSources} updatedAt={snapshot.updatedAt} />
      <Toast message={toastMessage} />
    </>
  );
}
