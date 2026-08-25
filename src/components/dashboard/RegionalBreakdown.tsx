import { useMemo } from "react";
import type { RegionMetric, RegionName } from "../../domain/climate";

type Props = {
  region: RegionName;
  rows: RegionMetric[];
  query: string;
};

export default function RegionalBreakdown({ region, rows, query }: Props) {
  const filtered = useMemo(() => {
    const list = rows.map((item) => ({
      item,
      search: (item.name + " " + item.metric + " " + item.sub).toLowerCase(),
    }));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return list.filter((r) => r.search.indexOf(q) !== -1);
    }
    return list;
  }, [rows, query]);

  return (
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
        {filtered.map((r) => (
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
      {filtered.length === 0 && (
        <p className="empty" id="region-empty">
          No regions match your search.
        </p>
      )}
    </div>
  );
}
