import { SOURCES, type Attribution } from './attribution.js';
import {
  curvePoints,
  ettjSlope,
  forwardPoints,
  tesouroMetrics,
  type CurvePoint,
  type FocusRow,
  type ForwardPoint,
  type Nss,
  type Series,
  type TesouroBond,
  type TesouroMetrics,
} from './curve.js';

export type MarketSnapshot = {
  asOf: string;
  vertices: CurvePoint[];
  forwards: ForwardPoint[];
  /** ETTJ nominal 5y − 1y, percentage points. */
  slope5y1y: number;
  tesouro: TesouroMetrics | null;
  sources: Attribution[];
};

/**
 * One curve date.
 *
 * Focus rows, Selic and Tesouro bonds dated after `asOf` are ignored. The dashboard
 * has no historical `asOf` (it always runs on the latest file); clipping is what you
 * get by running that code on the morning of `asOf`.
 */
export function marketOn(input: {
  asOf: string;
  nominal: Nss;
  real: Nss;
  focusIpca?: readonly FocusRow[];
  tesouro?: readonly TesouroBond[];
  focusSelic?: readonly FocusRow[];
  selicMeta?: Series;
}): MarketSnapshot {
  const focusIpca = (input.focusIpca ?? []).filter((r) => r.Data <= input.asOf);
  const sources: Attribution[] = [SOURCES.anbima];
  if (focusIpca.length) sources.push(SOURCES.focus, SOURCES.cmn);
  let tesouro: TesouroMetrics | null = null;
  if (input.tesouro) {
    sources.push(SOURCES.tesouro);
    const focusSelic = input.focusSelic ?? [];
    const selic = input.selicMeta ?? [];
    if (focusSelic.length) {
      if (!sources.includes(SOURCES.focus)) sources.push(SOURCES.focus);
    }
    if (selic.length) sources.push(SOURCES.sgs);
    tesouro = tesouroMetrics(input.asOf, input.tesouro, focusSelic, selic);
  }
  return {
    asOf: input.asOf,
    vertices: curvePoints(input.asOf, input.nominal, input.real),
    forwards: forwardPoints(input.asOf, input.nominal, input.real, focusIpca),
    slope5y1y: ettjSlope(input.nominal),
    tesouro,
    sources,
  };
}
