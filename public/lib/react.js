"use client";

/*!
 * nodality/react — host a Nodality render inside a React tree.
 *
 *   import Nodality from "nodality/react";
 *
 *   <Nodality elements={E} nodes={N} />                    // a specification
 *   <Nodality view={() => new Wrapper()...} deps={[x]} />  // component code you own
 *
 * Both of the library's regimes are first-class. The pair is what a
 * generator emits and what the compiler consumes; the component classes are
 * what the compiler EMITS, and what a developer takes ownership of
 * afterwards. A React binding that supported only one of them would be
 * describing half the library.
 *
 * They differ in exactly one respect: only the specification survives the
 * build boundary. A specification is data, so a prerenderer can find it in
 * the page (the <script data-nodality-for> this emits) and render it to HTML
 * at build time. A `view` is a closure over your module graph — it cannot be
 * serialised into the document, so it renders on the client only.
 *
 * Moved here from create-nodality-react's template (src/Nodality.jsx) so
 * every React app imports one maintained copy. The markup it emits is
 * unchanged, so that template's prerender.mjs keeps working.
 *
 * Plain JavaScript rather than JSX: bundlers do not compile JSX inside
 * node_modules. "use client" marks it as a client component for the Next.js
 * App Router; other bundlers ignore it. `Des` comes from "nodality" itself
 * rather than ../layout, so an app that also imports "nodality" loads ONE
 * copy of the library — two copies would mean two Theme singletons and two
 * element registries.
 *
 * React 18 or later (useId). React is an optional peer dependency: nothing
 * else in nodality needs it.
 */

import { createElement, Fragment, useEffect, useId, useMemo, useRef } from "react";
import { Des } from "nodality";

/**
 * @param {object} props
 * @param {Array<object>} [props.elements]  Regime 1: the specification's elements (E).
 * @param {Array<object>} [props.nodes]     Regime 1: its nodes (N).
 * @param {object} [props.defs]             Regime 1: definitions, passed to Des.defs().
 * @param {() => {render(): Node}} [props.view]
 *        Regime 2: a factory returning a Nodality component. A factory rather
 *        than an instance so it is not rebuilt on every parent render.
 * @param {Array<unknown>} [props.deps]     When to rebuild `view` — same meaning as useEffect's.
 * @param {string} [props.className]
 * @param {object} [props.style]
 */
export function Nodality({
  elements,
  nodes = [],
  defs,
  view,
  deps = [],
  className,
  style,
}) {
  const host = useRef(null);

  // Des mounts by CSS selector, and React's useId contains ':' — invalid in a
  // selector. Strip it. useId is stable across server and client, so the id
  // still matches whatever a prerenderer wrote into the document.
  const domId = "nod-" + useId().replace(/:/g, "");

  // Key the effect on the SPECIFICATION by value, not on prop identity. A
  // parent re-render creates fresh object literals every time; depending on
  // those rebuilt the whole subtree on every keystroke, losing focus, scroll
  // position and animation state.
  const spec = useMemo(
    () => (elements ? JSON.stringify({ elements, nodes, defs }) : null),
    [elements, nodes, defs],
  );

  // Same problem, different shape: an inline `view={() => …}` is a new
  // function every render. Hold the latest in a ref and rebuild only when the
  // caller's own `deps` say to. Serialised rather than spread, because a
  // dependency array that changes length between renders is a React error.
  const viewRef = useRef(view);
  viewRef.current = view;
  const depsKey = useMemo(() => {
    try { return JSON.stringify(deps); } catch { return String(deps); }
  }, [deps]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    // Prerendered markup is static: it exists for crawlers and for first
    // paint. The builder still has to run to attach behaviour, so replace it
    // rather than adopt it.
    el.innerHTML = "";

    if (viewRef.current) {
      // render() with no argument returns a detached node rather than
      // mounting, so nothing escapes this host.
      el.appendChild(viewRef.current().render());
    } else if (elements) {
      const d = new Des();
      if (defs) d.defs(defs);
      d.nodes(nodes)
        .add(elements)
        .set({ mount: "#" + domId, code: false, elements: false, layout: false });

      // Des.set() appends a <pre> and a <textarea id="elements"> to
      // document.body — the on-page code panel. `code: false` only hides them,
      // so without this every mount leaks two nodes and every instance after
      // the first duplicates id="elements". Reaching for the instance's own
      // handles removes exactly what this render created, rather than querying
      // the page for the first match.
      d._preEl?.remove();
      d._codeEl?.remove();
    }

    return () => {
      el.innerHTML = "";
    };
    // `spec` and `depsKey` cover the inputs by value; that is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, depsKey, domId]);

  return createElement(
    Fragment,
    null,
    // A prerenderer writes HTML into this div AFTER React has rendered it, so
    // React's virtual tree says "empty" while the DOM says otherwise.
    // suppressHydrationWarning is not enough — it covers attributes and text,
    // not extra element children, and hydration fails with React #418/#423
    // and silently re-renders the whole root on the client. An empty
    // dangerouslySetInnerHTML is the documented escape for externally-managed
    // DOM: React stops reconciling this subtree entirely, which is exactly
    // the contract wanted. It also means the built output survives every
    // subsequent React render, since the prop value never changes.
    createElement("div", {
      id: domId,
      ref: host,
      className,
      style,
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: { __html: "" },
    }),
    // A specification travels with the page so a prerenderer can find it
    // without knowing anything about the app's component tree. A `view` has
    // nothing to emit here — code does not cross the build boundary. '<' is
    // escaped so a string containing </script> cannot close it.
    spec &&
      createElement("script", {
        type: "application/json",
        "data-nodality-for": domId,
        dangerouslySetInnerHTML: { __html: spec.replace(/</g, "\\u003c") },
      }),
  );
}

export default Nodality;
