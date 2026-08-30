/**
 * The repair loop — Tier 7 of AGENTIC-FIRST-PLAN.md §10.
 *
 * Every number this project has published is FIRST-TRY. That measures a
 * generator, and agentic-first is not a generator; it is a loop. Six tiers
 * went into diagnostics worded so a machine could act on them — `did you
 * mean`, the content-slot table, `DANGLING_REF` over the defined names, the
 * throw that names the wrong ORDER instead of surfacing as `undefined` deep
 * in the mapper. Not one of those wordings has ever been handed back to a
 * model to see whether it repairs from them. This is that measurement.
 *
 * The loop is one turn: generate, run the shipped tools over the result, hand
 * the reports back verbatim, take the second answer. One turn rather than
 * many, because "repairable in one turn" is the claim the diagnostics were
 * written to support, and a loop that runs until it converges would measure
 * persistence instead.
 *
 * WHAT THE AGENT IS ALLOWED TO SEE — this is the whole fairness question, and
 * the loop runs in two modes so the answer is not a matter of opinion:
 *
 *   library   only what the SHIPPED tools report: the `validate_nodes` JSON,
 *             the render throw, the `check_page` JSON. Every one of these is
 *             reachable by any agent holding the library and its own spec.
 *             This is the defensible number.
 *
 *   full      the above, plus which strings the task asked for that are not
 *             in the rendered page. An agent CAN in principle derive this —
 *             it holds the task and can read back what it rendered — but the
 *             list here is the SCORER'S, extracted by the same hand that
 *             wrote the answer key. It is an upper bound, and reported as
 *             one. Never quote it as the repair rate.
 *
 * The difference between the two is the interesting quantity, not a detail to
 * be averaged away: it is the share of failures the library can see at all.
 */

/** Reports that exist for this result — the raw ones, not the display notes. */
const diagsOf = (result) =>
  result.pages ? result.pages.map((p) => ({ page: p.id.split("/")[1], d: p.diag }))
               : [{ page: null, d: result.diag }];

/**
 * Does the LIBRARY have anything to say? This is the retry trigger in library
 * mode, and it is deliberately not "did the brief fail". A real agent does not
 * know which of its pages failed an eval; it knows what its tools reported. So
 * the loop fires on the tools' verdict, which also means it can fire on a
 * brief that already passed — and a repair that breaks one of those is a
 * regression the run has to be able to see.
 */
export const librarySpeaks = (result) =>
  diagsOf(result).some(({ d }) =>
    !!d && (d.threw || (d.validate && !d.validate.ok) || (d.quality && !d.quality.ok)));

export const contentSpeaks = (result) =>
  diagsOf(result).some(({ d }) =>
    !!d && (d.missing?.length || d.leaked?.length || d.undescribed));

/**
 * The message the agent receives. Reports go back as the JSON the MCP tools
 * actually return — `bin/mcp-server.mjs` replies with
 * `JSON.stringify(report, null, 2)` and nothing else, so anything friendlier
 * here would be measuring a library nobody has.
 */
export function feedback(result, { includeContent = false } = {}) {
  const blocks = [];
  for (const { page, d } of diagsOf(result)) {
    if (!d) continue;
    const where = page ? ` (page "${page}")` : "";
    const part = [];

    if (d.validate && !d.validate.ok) {
      part.push(`validate_nodes${where}:\n${JSON.stringify(d.validate, null, 2)}`);
    }
    if (d.threw) {
      // A throw is library-visible: the agent ran the code and caught it.
      part.push(`rendering${where} threw:\n${d.threw}`);
    }
    if (d.quality && !d.quality.ok) {
      part.push(`check_page${where}:\n${JSON.stringify(d.quality, null, 2)}`);
    }
    if (includeContent) {
      if (d.missing?.length) {
        part.push(`Reading back the page you rendered${where}, text the task asked ` +
          `for does not appear: ${d.missing.map((s) => JSON.stringify(s)).join(", ")}`);
      }
      if (d.leaked?.length) {
        part.push(`Text the task forbade appears in the rendered page${where}: ` +
          `${d.leaked.map((s) => JSON.stringify(s)).join(", ")}`);
      }
      if (d.undescribed) {
        part.push(`Images in the rendered page${where} carry no alt or aria-label.`);
      }
    }
    if (part.length) blocks.push(part.join("\n\n"));
  }
  if (!blocks.length) return null;

  return `Your spec was checked with the tools that ship with the library. ` +
    `They reported the following.\n\n${blocks.join("\n\n")}\n\n` +
    `Fix these and return the corrected spec. Reply with the COMPLETE spec in ` +
    `the same JSON contract as before — the whole thing, not a patch, not a ` +
    `diff, and no prose.`;
}
