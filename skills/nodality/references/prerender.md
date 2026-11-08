# Static site generation

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

## Static site generation

`npx nodality prerender` interprets the same pair at build time: it
emits crawlable HTML, a sitemap, `hreflang` alternates, and JSON-LD. The
browser then re-reads the pair and rebuilds on top – the pair is
*shipped, not consumed*. `jsdom` must be present in the project
(deliberately not bundled). Builds are deterministic: the same pair
yields byte-identical output, so diffing two builds is a valid check.
