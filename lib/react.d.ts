// Types for nodality/react. Hand-written: scripts/generate-types.mjs covers
// the main bundle (dist/index.d.ts), not the lib/ subpaths.

import type { CSSProperties, ReactElement } from "react";

/** Anything with Nodality's render(): every component class, e.g. Wrapper or Text. */
export interface NodalityRenderable {
  render(): Node;
}

export interface NodalityProps {
  /** Regime 1 — the specification's elements (E). */
  elements?: Array<Record<string, unknown>>;
  /** Regime 1 — its nodes (N). */
  nodes?: Array<Record<string, unknown>>;
  /** Regime 1 — definitions, passed to Des.defs(). */
  defs?: Record<string, unknown>;
  /**
   * Regime 2 — a factory returning a Nodality component. A factory rather than
   * an instance so it is not rebuilt on every parent render; client-side only.
   */
  view?: () => NodalityRenderable;
  /** When to rebuild `view` — same meaning as useEffect's dependency array. */
  deps?: ReadonlyArray<unknown>;
  className?: string;
  style?: CSSProperties;
}

export declare function Nodality(props: NodalityProps): ReactElement;
export default Nodality;
