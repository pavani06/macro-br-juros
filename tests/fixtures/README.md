# Fixtures

Expected numbers were produced by running the dashboard code, not by reimplementing it inside the test.

## Source

`lib/mercado.ts`, `lib/mercado-ettj.ts`, `lib/sources.ts` (SGS date parsing and Focus rows, as executed by `getMercado`), `lib/ts.ts` (the `Series` shape only) and `META` from `lib/data.ts`, from macro-brasil-dashboard commit `fc22eb8`.

The private repository is not available to CI. Generation ran locally against that tree. Nothing from the dashboard was committed here: no Carteira, Supabase, Blob, Leitura, or KPI/home UI.

## Inputs

Frozen on 2026-10-15 from the public endpoints the dashboard calls:

- ANBIMA `CZ-down.asp` (POST `Dt_Ref`) → `cz/YYYY-MM-DD.csv`
- ANBIMA `msYYMMDD.txt` → `ms/`
- Tesouro Transparente `PrecoTaxaTesouroDireto.csv`, rows for the five dates only → `preco-taxa.csv`
- BCB Olinda `ExpectativasMercadoAnuais` for IPCA and Selic, `baseCalculo=0`, `Data ge 2026-01-01` → `focus/`
- BCB SGS 432 from 01/09/2026 to 15/10/2026 → `sgs/selic-432.json`

These files are third-party data. They are not covered by the MIT license. ANBIMA is redistributed with attribution (see the package README).

## Dates

| Date | Why this one |
|---|---|
| 2026-09-14 | Monday. Earliest session `CZ-down.asp` still returned when the files were frozen. |
| 2026-09-18 | Friday, the session before a weekend. |
| 2026-10-01 | Thursday, first session of the month. |
| 2026-10-09 | Friday, last session before the 12 October holiday (Nossa Senhora Aparecida, a Monday) and the weekend. |
| 2026-10-13 | Tuesday, first session after that holiday and weekend. The holiday itself is not a curve date: the endpoint returned an empty body. |

Older sessions (January, April, early September) came back empty from `CZ-down.asp`, so they could not be frozen from that source.

## How `expected.json` was built

A temporary harness, not part of this repo, did the following for each date:

1. Copied the `fc22eb8` `lib/` files. `yrs`, `fisher`, `interp` and `r2` were re-exported. Their formulas were not edited.
2. Stubbed `server-only`, `@vercel/blob` and `@supabase/supabase-js`. `indicador-cache` called the live function (a cache miss). `lerComFallback` returned the file fallback, which is the dashboard path when the Supabase flag is absent.
3. Froze `Date` at 15:00Z on that date (noon in America/Sao_Paulo, UTC−3).
4. Pointed `fetch` at these files. Focus rows with `Data` after the curve date were left out, because those surveys did not exist yet that morning. The ETTJ snapshot CSV contained only that date, so "latest" was that date.
5. Called `getMercado()`.
6. Computed the same vertices, forwards, slope and Tesouro metrics with the dashboard's own `nss`, `yrs`, `fisher` and `interp`, and required the dashboard's 2-decimal rounding of those raw values to equal the charts, the vertex table and the slope KPI.
7. Wrote the raw values to `expected.json`.

CI only reads `expected.json` and the files above. It does not clone the private dashboard.

## Judgment calls

- Network clients in `sources.ts` were not ported. Callers pass Focus rows and SGS points. HP, STL and the rest of `ts.ts` were not ported; the curve math does not use them.
- `marketOn` ignores Focus, Selic and Tesouro observations after `asOf`. The dashboard has no historical as-of; it always reads the latest file. Clipping is what running that code on the morning of `asOf` does.
- Forward years stay the dashboard constants (2027, 2028, 2029, 2030, 2031–35). They are not a rolling window. Focus for 2031 is missing from Olinda in this sample, so that bucket's Focus value is null. The breakeven is still computed.
- The real curve under 0.5 years is `null` here. The dashboard stores NaN in the chart and an em dash in the table.
- The package returns full precision. The dashboard rounds series to 2 decimals for display. On these five dates the full-precision difference is 0 bp. The acceptance bar is 0.5 bp.
- Zero-coupon and coupon Tesouro bonds are interpolated together, as in `tesouroDireto`.
- Reproduction compares `nss` at `businessDays / 252` with the published ETTJ vertex rate. That tenor is the unit of the vertex column, and on the standard grid it equals the year fraction the dashboard already uses (`21/252 = 1/12`, `252/252 = 1`, …). It does not switch the dashboard's calendar/365.25 convention for arbitrary dates.
- Title-by-title residuals are larger than 5 bp. ANBIMA prints them in the CZ file ("Erro Título a Título"): about 12.9 to 18.9 bp on these dates. Evaluating NSS at the bond's calendar/365.25 maturity against the indicative rate in `ms*.txt` is about 15.6 to 25.8 bp. The 5 bp gate is the published vertex grid, where the error is about 0.01 bp (published rates are rounded to 4 decimals). The Tesouro NSS refit (plan B) was not built.
- The date probe skips Saturday and Sunday only. A weekday holiday such as 2026-10-12 is still a candidate; if that file is missing, the probe continues. There is no holiday calendar in the dashboard, so none was added.
