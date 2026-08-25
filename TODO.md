# Data wiring backlog

Everything else on the dashboard is live. Items below have **no usable keyless
open endpoint** today — revisit periodically, wire immediately if one appears.

- **Antarctic shelf calving events** (Larsen–Thwaites sector): no open
  time-series API. The hardcoded fixture row was removed rather than faked.
  Candidate sources to watch: NASA ICESat-2/ATLAS products, ESA Antarctic
  ice-sheet mass products.
- **Future projection lines on the chart** (2026→2100 scenarios in
  `src/data/fixtures.ts`): synthetic by design. Real CMIP6 output requires
  heavy subsetting; no simple CSV endpoint exists (unlike AGGI/GISTEMP).
- **Black Carbon & ground-level O₃ forcing shares**: excluded from NOAA AGGI
  (short-lived agents). No open time-series; rows were dropped from the
  Super Pollutant breakdown rather than shown as static numbers.

Editorial event chips in `EventStrip` are intentionally curated content, not a
data gap.
