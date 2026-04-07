// Nodality Theme — central dark/light mode + event bus.
// No CSS. Components declare per-mode inline styles via .set({ theme: {...} }).

const STORAGE_KEY = "nodality.theme.mode";
const EVENT_NAME = "nodality:theme";

function detectInitialMode() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    if (typeof window !== "undefined" && window.matchMedia) {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    }
    return "light";
}

const Theme = {
    mode: detectInitialMode(),
    tokens: { light: {}, dark: {} },

    // Built-in defaults applied to every component that did NOT declare its own
    // .theme({...}) map. EMPTY by default so upgrading an existing site changes
    // nothing — components keep whatever inline styles they already had.
    //
    // To turn on automatic theming for every component in one line:
    //   Theme.setDefaults({
    //     light: { color: "#111" },
    //     dark:  { color: "#eee" }
    //   });
    //
    // Per-component theming via .set({ theme: {...} }) works regardless of
    // whether defaults are set.
    defaults: {
        light: {},
        dark:  {}
    },

    setDefaults(map) {
        if (map && typeof map === "object") {
            if (map.light) this.defaults.light = Object.assign({}, this.defaults.light, map.light);
            if (map.dark)  this.defaults.dark  = Object.assign({}, this.defaults.dark,  map.dark);
            this._broadcast();
        }
        return this;
    },

    setTokens(tokens) {
        if (tokens && typeof tokens === "object") {
            if (tokens.light) Object.assign(this.tokens.light, tokens.light);
            if (tokens.dark) Object.assign(this.tokens.dark, tokens.dark);
        }
        return this;
    },

    get current() {
        return this.tokens[this.mode] || {};
    },

    set(mode) {
        if (mode !== "light" && mode !== "dark") return this;
        if (mode === this.mode) return this;
        this.mode = mode;
        try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {}
        this._broadcast();
        return this;
    },

    toggle() {
        return this.set(this.mode === "dark" ? "light" : "dark");
    },

    subscribe(fn) {
        if (typeof document === "undefined") return () => {};
        const handler = (e) => fn(e.detail.mode, e.detail.tokens);
        document.addEventListener(EVENT_NAME, handler);
        // Fire once with current state so late subscribers sync immediately.
        try { fn(this.mode, this.current); } catch (e) {}
        return () => document.removeEventListener(EVENT_NAME, handler);
    },

    _broadcast() {
        if (typeof document === "undefined") return;
        document.dispatchEvent(new CustomEvent(EVENT_NAME, {
            detail: { mode: this.mode, tokens: this.current }
        }));
    }
};

export { Theme };
