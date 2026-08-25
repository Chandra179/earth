import type { EditorialChip, LiveChip } from "./events";

type Props = {
  editorial: EditorialChip[];
  live: LiveChip[];
  onFocusPoint: (i: number) => void;
  onToast: (msg: string) => void;
};

export default function EventStrip({ editorial, live, onFocusPoint, onToast }: Props) {
  if (!editorial.length && !live.length)
    return (
      <div className="event-strip">
        <span className="axis-label">No marked events in this window</span>
      </div>
    );
  return (
    <div className="event-strip" aria-label="Events in this range">
      {editorial.map((it) => (
        <button key={it.i} type="button" className="event-chip" onClick={() => onFocusPoint(it.i)}>
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
            if (it.focus != null) onFocusPoint(it.focus);
            onToast(it.ev);
          }}
        >
          <b>{it.label}</b>
          {it.ev}
        </button>
      ))}
    </div>
  );
}
