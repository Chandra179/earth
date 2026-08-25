type Props = {
  liveSources: string[];
  updatedAt: string;
};

export default function DashboardFooter({ liveSources, updatedAt }: Props) {
  return (
    <footer className="footbar" data-od-id="footer">
      <div className="shell footbar-inner">
        <span className="live">
          <span className="pulse" />
          {liveSources.length ? "LIVE" : "DEMO"} · updated {updatedAt}
        </span>
        <span>
          {liveSources.length
            ? "Live sources: " + liveSources.join(", ")
            : "Sources: NOAA · NASA GISS · ESA CCI · prototype estimates for evaluation"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)" }}>Dataset: 27yr annual · 60mo · 120d</span>
      </div>
    </footer>
  );
}
