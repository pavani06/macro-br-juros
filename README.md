# macro-br-juros

Pure TypeScript functions for Brazilian interest rates and implied inflation. Callers pass the data in. The package does not fetch, read the environment, or touch the network.

The calculations follow the curve math in [macro-brasil-dashboard](https://github.com/pavani06/macro-brasil-dashboard) `lib/` at commit `fc22eb8`.

## Method

The nominal curve is the ANBIMA prefixados Nelson-Siegel-Svensson fit: the published betas go into `nss`, they are not estimated here. The real curve is the same function on the IPCA betas. Vertices shorter than six months are left out, because there is no short NTN-B and the fit is not trustworthy there. Tesouro IPCA+ and prefixados rates are interpolated linearly in maturity, with a flat extrapolation of at most 1.5 years.

Spot implied inflation is the Fisher identity, `(1 + nominal) / (1 + real) − 1`. Forward implied inflation compounds that identity between 1 January of two years. The buckets are the dashboard's fixed ones: calendar years 2027, 2028, 2029, 2030, and 2031–35. Each bucket is set next to the latest Focus IPCA median for that year and the CMN target.

Slope is nominal 5 years minus nominal 1 year. Term premium is the interpolated 1-year nominal rate minus an expected CDI: the Selic target walks in a straight line to the Focus Selic at the end of this year and the next, the path is sampled every five days for a year, and 0.10 percentage point is subtracted (CDI ≈ Selic − 0.10).

Tenors between two dates are calendar days / 365.25, the dashboard's stand-in for ANBIMA's business days / 252. The published ETTJ vertex column is already in business days, so reproducing those rates uses du/252.

The live-file date probe skips Saturday and Sunday on a UTC−3 clock. It has no holiday list: a weekday holiday is still requested, and a miss falls back to the previous candidate.

## Data

Outputs that use third-party data carry a `sources` field. That data is not covered by the MIT license of this code.

| Provider | What | Attribution |
|---|---|---|
| ANBIMA | ETTJ NSS betas (`CZ-down.asp`) and indicative rates (`ms*.txt`) | Cite ANBIMA. Public redistribution is allowed with attribution. |
| Tesouro Transparente | Preço e Taxa do Tesouro Direto | Open data. Not MIT. |
| BCB Focus (Olinda) | Annual IPCA and Selic medians, `baseCalculo=0` | Open data. Not MIT. |
| BCB SGS 432 | Selic target | Open data. Not MIT. |
| CMN | IPCA target | Public target. Not MIT. |

## License

MIT, copyright Fernando Pavani. See [LICENSE](LICENSE).
