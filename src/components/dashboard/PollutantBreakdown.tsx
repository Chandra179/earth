import type { Pollutant } from "../../domain/climate";
import { NoteWithTerm } from "../ui/Term";

export default function PollutantBreakdown({ pollutants }: { pollutants: Pollutant[] }) {
  return (
    <div className="card" data-od-id="pollutant-breakdown">
      <div className="bd-head">
        <span className="h">Super Pollutant Breakdown</span>
        <span className="meta">share of non-CO₂ forcing</span>
      </div>
      <div className="breakdown" id="pollutant-list" style={{ marginTop: "var(--space-3)" }}>
        {pollutants.map((p) => {
          const badgeCls = p.trend;
          const arrow = p.trend === "up" ? "↑ rising" : p.trend === "down" ? "↓ falling" : "→ stable";
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
                <span className={"delta " + badgeCls}>{arrow}</span> <NoteWithTerm note={p.note} word={p.termWord} def={p.termDef} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
