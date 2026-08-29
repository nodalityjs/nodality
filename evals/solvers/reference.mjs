// A hand-written correct answer per brief. Not a model — this is the CONTROL.
//
// An eval harness whose scorer is wrong is worse than none, because it will
// confidently report a number. This solver is what proves the scorer can say
// "pass" when it should; `broken.mjs` is what proves it can say "fail". Any
// model solver is measured against the same gates these two calibrate.
export const name = "reference (hand-written)";
export function solve(brief) {
  switch (brief.id) {
    case "hero": return { elements: [
      { type: "h1", text: "Ship faster" },
      { type: "p", text: "Deploy in seconds, not hours." },
      { type: "a", text: "Get started", url: "/signup" },
    ]};
    case "cards-homogeneous": return { elements: [
      { type: "cards", items: ["Orbit", "Relay", "Beacon"].map((n) => (
        { img: `https://example.com/${n.toLowerCase()}.jpg`, title: n, link: `/p/${n.toLowerCase()}` })) },
    ]};
    case "cards-heterogeneous": return { elements: [
      { type: "cards", items: [
        [{ type: "h2", text: "Alpha" }, { type: "p", text: "One." }, { type: "p", text: "Two." }],
        [{ type: "h2", text: "Beta" }],
        [{ type: "h2", text: "Gamma" }, { type: "a", text: "More", url: "/gamma" }],
      ]},
    ]};
    case "nav": return { elements: [
      { type: "nav", items: [
        { title: "Home", link: "/" }, { title: "Docs", link: "/docs" },
        { title: "Pricing", link: "/pricing" },
      ]},
    ]};
    case "table": return { elements: [
      { type: "table", items: [{ sku: "X1", name: "Widget" }, { sku: "X2", name: "Gadget" }] },
    ]};
    case "article": return { elements: [
      { type: "h1", text: "Why latency matters" },
      { type: "h2", text: "The numbers" },
      { type: "p", text: "A 100ms delay costs 1% of sales." },
    ]};
    case "list": return { elements: [
      { type: "ulist", items: ["Fast", "Cheap", "Reliable"] },
    ]};
    case "sidenav": return { elements: [
      { type: "sideNav", items: [
        { title: "Overview", link: "/overview" }, { title: "Billing", link: "/billing" },
      ]},
    ]};
    case "accessible-cards": return { elements: [
      { type: "cards", items: [
        { img: "https://example.com/rocket.jpg", title: "Rocket", link: "/rocket",
          alt: "A rocket on the launch pad" },
        { img: "https://example.com/rover.jpg", title: "Rover", link: "/rover",
          alt: "A rover on red soil" },
      ]},
    ]};
    case "mixed-page": return { elements: [
      { type: "nav", items: [{ title: "Home", link: "/" }, { title: "About", link: "/about" }] },
      { type: "h1", text: "Acme" },
      { type: "p", text: "We make things." },
      { type: "cards", items: [
        { img: "https://example.com/w.jpg", title: "Widget", link: "/widget" },
        { img: "https://example.com/g.jpg", title: "Gadget", link: "/gadget" },
      ]},
    ]};
    // ── derived from relaysLanding, a site written before this eval existed ──
    case "relays-hero": return { elements: [
      { type: "h1", text: "Find your relay partner" },
      { type: "h2", text: "It has never been so easy to find your match" },
      { type: "a", text: "Find a partner", url: "/app" },
      { type: "a", text: "Browse all races", url: "race-list.html" },
    ]};
    case "relays-race-cards": return { elements: [
      { type: "cards", items: [
        [{ type: "h2", text: "Maratonská štafeta" }, { type: "p", text: "Havířov, Czech Republic" }],
        [{ type: "h2", text: "Vltava Run" }, { type: "p", text: "Šumava" }],
        [{ type: "h2", text: "Moraviaman" }, { type: "p", text: "Otrokovice, Czech Republic" }],
      ]},
    ]};
    case "relays-how-it-works": return { elements: [
      { type: "h2", text: "How it works" },
      { type: "h3", text: "1" }, { type: "p", text: "Add your times" },
      { type: "h3", text: "2" }, { type: "p", text: "Pick your races" },
      { type: "h3", text: "3" }, { type: "p", text: "Meet your partner" },
    ]};
    case "relays-filters": return { elements: [
      { type: "dropdown", items: ["All countries", "CZE", "POL", "DEU", "AUT"] },
      { type: "input", placeholder: "Search races by name" },
    ]};
    case "relays-footer": return { elements: [
      { type: "wrap", children: [
        { type: "h3", text: "Relays" },
        { type: "p", text: "Find a relay partner for any race in the world. Free." },
        { type: "p", text: "Product" },
        { type: "a", text: "Races", url: "race-list.html" },
        { type: "a", text: "How it works", url: "index.html#how-it-works" },
        { type: "p", text: "Legal" },
        { type: "a", text: "Terms & privacy", url: "relays-terms.html" },
      ]},
    ]};
    case "relays-empty-state": return { elements: [
      { type: "p", text: "No races match those filters." },
      { type: "a", text: "Clear filters", url: "race-list.html" },
    ]};

    // ── types the first ten never exercised ──
    case "form": return { elements: [
      { type: "h2", text: "Get in touch" },
      { type: "form", children: [{ type: "labelInput", label: "Email" }] },
    ]};
    case "image": return { elements: [
      { type: "img", url: "https://example.com/launch.jpg", alt: "A rocket lifting off" },
    ]};
    case "stacked-sections": return { elements: [
      { type: "h2", text: "Speed" }, { type: "p", text: "Fast to build." },
      { type: "h2", text: "Cost" }, { type: "p", text: "Cheap to run." },
      { type: "h2", text: "Trust" }, { type: "p", text: "Hard to break." },
    ]};
    case "wide-table": return { elements: [
      { type: "table", items: [
        { date: "29/08/2026", race: "Krusnoman", country: "CZE", discipline: "Triathlon" },
        { date: "05/09/2026", race: "Hory Bory", country: "CZE", discipline: "Run" },
      ]},
    ]};
    case "nested-row": return { elements: [
      { type: "row", children: [
        { type: "wrap", children: [{ type: "h2", text: "Left" }, { type: "p", text: "One." }] },
        { type: "wrap", children: [{ type: "h2", text: "Right" }, { type: "p", text: "Two." }] },
      ]},
    ]};
    case "long-copy": return { elements: [
      { type: "h1", text: "Latency" },
      { type: "h2", text: "Measurement" },
      { type: "p", text: "You cannot budget for what you have not measured at the tail." },
      { type: "h2", text: "Budget" },
      { type: "p", text: "Spend the budget where the user is actually waiting for something." },
      { type: "h2", text: "Tradeoffs" },
      { type: "p", text: "Every cache you add is a correctness problem you have chosen to own." },
    ]};

    // ── multi-page. The chrome is written out per page, which is exactly the
    //    repetition Tier 3 measures: there is no reuse primitive in the data. ──
    // Multi-page: the chrome is DECLARED ONCE and referenced. This is the
    // acceptance test for Tier 3 — the mechanism has to survive the same four
    // gates as everything else, not just a token count.
    case "site-two-page": return {
      defs: {
        nav: { type: "nav", items: [
          { title: "Relays", link: "index.html" },
          { title: "Races", link: "race-list.html" },
          { title: "How it works", link: "index.html#how-it-works" },
        ]},
        footer: { type: "wrap", children: [
          { type: "a", text: "Terms & privacy", url: "relays-terms.html" }] },
      },
      pages: {
        index: { elements: [{ $ref: "nav" }, { type: "h1", text: "Find your relay partner" },
                            { $ref: "footer" }] },
        races: { elements: [{ $ref: "nav" }, { type: "h1", text: "Every upcoming race" },
                            { $ref: "footer" }] },
      },
    };
    case "site-four-page": {
      const page = (h) => ({ elements: [{ $ref: "nav" }, { type: "h1", text: h },
                                        { $ref: "footer" }] });
      return {
        defs: {
          nav: { type: "nav", items: [
            { title: "Home", link: "/" }, { title: "Pricing", link: "/pricing" },
            { title: "Docs", link: "/docs" }, { title: "Contact", link: "/contact" },
          ]},
          footer: { type: "wrap", children: [{ type: "p", text: "Acme" }] },
        },
        pages: {
          home: page("We make things."), pricing: page("Plans"),
          docs: page("Reference"), contact: page("Get in touch"),
        },
      };
    }

    default: return { elements: [] };
  }
}
