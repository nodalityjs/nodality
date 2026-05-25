/*!
 * nodality/seo — SEO metadata helpers
 *
 * Exposes a single `applySeoMeta()` call that idempotently writes a
 * full per-page metadata bundle into <head>: description, canonical,
 * Open Graph (Facebook / iMessage / WhatsApp / Slack / LinkedIn),
 * Twitter / X card, and an optional schema.org JSON-LD payload.
 *
 * Also exports a handful of pre-built JSON-LD builders for the
 * common schema types (Organization, WebSite, Product, Article,
 * BreadcrumbList) so projects don't have to memorise the schema.org
 * field names.
 *
 * Works in both directions:
 *   • At SSG time (nodality prerender) the tags land in the static
 *     HTML response — crawlers and social-card scrapers index them.
 *   • At browser hydration time the same call re-applies the tags
 *     against the live <head>; idempotent via `data-seo="1"` markers,
 *     so re-rendering the page doesn't pile up duplicates.
 *
 * Origin handling: pass `path` as a leading-slash route ("/" or
 * "/blog/post-1") and configure the origin globally via
 * `setSeoOrigin("https://example.com")` once at app boot. Falls back
 * to `window.location.origin` in the browser if no origin is set;
 * falls back to "" under SSG (canonical-relative).
 */

let configuredOrigin = "";

export function setSeoOrigin(origin) {
  configuredOrigin = String(origin ?? "").replace(/\/+$/, "");
}

function resolveOrigin() {
  if (configuredOrigin) return configuredOrigin;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function upsert(selector, build) {
  if (typeof document === "undefined") return;
  // Drop the previously-managed tag (if any) and write a fresh one.
  // Safer than in-place mutation because the static template may have
  // shipped its own <title> or <meta charset>; we own only the
  // `data-seo="1"` set.
  document.head.querySelectorAll(selector).forEach((el) => el.remove());
  const el = build();
  if (el) document.head.appendChild(el);
}

function metaTag(nameAttr, name, content) {
  if (content == null || content === "") return null;
  const m = document.createElement("meta");
  m.setAttribute(nameAttr, name);
  m.setAttribute("content", String(content));
  m.setAttribute("data-seo", "1");
  return m;
}

/**
 * @param {object} opts
 * @param {string} [opts.path]        — page path relative to origin ("/" or "/blog/foo")
 * @param {string} [opts.title]       — used for OG / Twitter title (NOT <title>)
 * @param {string} [opts.description] — meta description + OG / Twitter description
 * @param {string} [opts.image]       — hero image (absolute, or origin-relative starting with "/")
 * @param {string} [opts.ogType]      — defaults to "website"; products use "product", articles "article"
 * @param {string} [opts.siteName]    — defaults to ""; appears in OG site_name
 * @param {object} [opts.jsonLd]      — optional schema.org payload (object or @graph wrapper)
 */
export function applySeoMeta(opts) {
  if (typeof document === "undefined") return;

  const origin = resolveOrigin();
  const canonicalUrl = opts.path
    ? (origin ? new URL(opts.path, origin).toString() : opts.path)
    : origin || "";

  let absoluteImage = null;
  if (opts.image) {
    absoluteImage = /^https?:/i.test(opts.image)
      ? opts.image
      : (origin ? new URL(opts.image, origin).toString() : opts.image);
  }

  upsert('meta[name="description"][data-seo]', () =>
    metaTag("name", "description", opts.description));

  upsert('link[rel="canonical"][data-seo]', () => {
    if (!canonicalUrl) return null;
    const l = document.createElement("link");
    l.setAttribute("rel", "canonical");
    l.setAttribute("href", canonicalUrl);
    l.setAttribute("data-seo", "1");
    return l;
  });

  // Open Graph — Facebook, WhatsApp, iMessage, LinkedIn, Slack.
  upsert('meta[property="og:type"][data-seo]', () =>
    metaTag("property", "og:type", opts.ogType ?? "website"));
  upsert('meta[property="og:title"][data-seo]', () =>
    metaTag("property", "og:title", opts.title));
  upsert('meta[property="og:description"][data-seo]', () =>
    metaTag("property", "og:description", opts.description));
  upsert('meta[property="og:url"][data-seo]', () =>
    metaTag("property", "og:url", canonicalUrl));
  upsert('meta[property="og:image"][data-seo]', () =>
    metaTag("property", "og:image", absoluteImage));
  upsert('meta[property="og:site_name"][data-seo]', () =>
    metaTag("property", "og:site_name", opts.siteName));

  // Twitter / X — prefers its own tags, falls back to OG.
  upsert('meta[name="twitter:card"][data-seo]', () =>
    metaTag("name", "twitter:card", absoluteImage ? "summary_large_image" : "summary"));
  upsert('meta[name="twitter:title"][data-seo]', () =>
    metaTag("name", "twitter:title", opts.title));
  upsert('meta[name="twitter:description"][data-seo]', () =>
    metaTag("name", "twitter:description", opts.description));
  upsert('meta[name="twitter:image"][data-seo]', () =>
    metaTag("name", "twitter:image", absoluteImage));

  upsert('script[type="application/ld+json"][data-seo]', () => {
    if (!opts.jsonLd) return null;
    const s = document.createElement("script");
    s.setAttribute("type", "application/ld+json");
    s.setAttribute("data-seo", "1");
    s.textContent = JSON.stringify(opts.jsonLd);
    return s;
  });
}

// ─── JSON-LD builders ──────────────────────────────────────────────
//
// Each builder returns a plain object the caller can pass to
// `applySeoMeta({ jsonLd: ... })`. For pages that need to declare more
// than one type, wrap them in @graph:
//
//   applySeoMeta({ jsonLd: { "@context": "https://schema.org",
//     "@graph": [websiteJsonLd({ name, url }), organizationJsonLd({...}) ] } });

export function websiteJsonLd({ name, url, inLanguage } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    ...(inLanguage ? { inLanguage } : {}),
  };
}

export function organizationJsonLd({ name, url, logo, sameAs } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo ? { logo } : {}),
    ...(sameAs ? { sameAs } : {}),
  };
}

/**
 * Product schema. `priceCurrency` defaults to USD; pass your own
 * (e.g. "EUR", "CZK") if you ship internationally. `price` is the
 * numeric value as a string (schema.org spec) — pass undefined to
 * omit the offer block entirely.
 */
export function productJsonLd({ name, description, image, brand, category, sku, url, price, priceCurrency = "USD", availability = "https://schema.org/InStock" } = {}) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(image ? { image: Array.isArray(image) ? image : [image] } : {}),
    ...(brand ? { brand: typeof brand === "string" ? { "@type": "Brand", name: brand } : brand } : {}),
    ...(category ? { category } : {}),
    ...(sku ? { sku } : {}),
  };
  if (price != null) {
    ld.offers = {
      "@type": "Offer",
      ...(url ? { url } : {}),
      priceCurrency,
      price: String(price),
      availability,
    };
  }
  return ld;
}

export function articleJsonLd({ headline, description, image, author, datePublished, dateModified, publisher, url } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    ...(description ? { description } : {}),
    ...(image ? { image: Array.isArray(image) ? image : [image] } : {}),
    ...(author ? { author: typeof author === "string" ? { "@type": "Person", name: author } : author } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(publisher ? { publisher: typeof publisher === "string" ? { "@type": "Organization", name: publisher } : publisher } : {}),
    ...(url ? { mainEntityOfPage: url } : {}),
  };
}

/** items: [{ name, url }, ...] in breadcrumb order (root → leaf). */
export function breadcrumbJsonLd(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
