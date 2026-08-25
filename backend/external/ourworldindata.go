package external

import (
	"context"
	"fmt"
	"io"
	"net/http"
)

// DefaultIceMassCSVURL is the OWID grapher export of the NASA JPL GRACE /
// GRACE-FO mascon ice-sheet series (cumulative Gt vs. a 2002 baseline).
// The raw Tellus netCDF grids on PODAAC require Earthdata credentials;
// this derived series is keyless.
const DefaultIceMassCSVURL = "https://ourworldindata.org/grapher/ice-sheet-mass-balance.csv?v=1&csvType=full&useColumnShortNames=true"

const maxIceMassBytes = 8 << 20

// GetIceMassCSV downloads the raw ice-sheet mass balance CSV.
func (d dependencies) GetIceMassCSV(ctx context.Context) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.iceURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ourworldindata: HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxIceMassBytes))
}
