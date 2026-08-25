/*!
 * nodality v1.2.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */



import { Theme } from "../lib/theme.js";
import { applyRasterPipeline } from "../lib/raster-ops.js";

import { keyPattern } from "../lib/codegen.js";
// 22/08/2020 - 16:30
class Animator {
    
    constructor(){
         this.state = {
           isExpanded: false,
             isMovedUp: false,
              isMovedDown: false
        }

		this.openedElements = new WeakMap();

		// Auto-subscribe every component to Theme so dark-mode "just works"
		// even when the user never declared a per-component theme map.
		// in a microtask, by which time the synchronous chain has finished.
		if (typeof document !== "undefined") {
			this._themeUnsub = Theme.subscribe((mode) => this._applyTheme(mode));
			Promise.resolve().then(() => this._applyTheme(Theme.mode));
		}
    }

	// Raster ops (lib/raster-ops.js) are a display-time effect: the
	// element carries `raster: [{op, ...}, ...]` in its set() options
	// (injected by ElementMapper.filteroRaster from the Des nodes, or
	// written by hand), and the GPU pipeline attaches to this.res only
	// AFTER the element actually renders — i.e. once res is connected
	// to the document and has a layout box. Safe no-op headless.
	rasterize(list){
		if (!list || list.length === 0 || this._rasterHandle) return;
		if (this._rasterCancelled) return; // destroy() ran before we attached
		if (typeof document === "undefined" || typeof setTimeout === "undefined") return;
		// setTimeout, not requestAnimationFrame: rAF is throttled to a
		// standstill in backgrounded tabs, which would leave the effect
		// permanently unattached there.
		let attempts = 0;
		const tryAttach = () => {
			if (this._rasterHandle || this._rasterCancelled) return;
			if (this.res && this.res.isConnected) {
				try {
					this._rasterHandle = applyRasterPipeline(this.res, list);
				} catch (e) {
					console.warn("[nodality] raster pipeline skipped:", e);
					return;
				}
				if (this._rasterHandle) return; // attached
				// null: layout box not ready yet (or WebGL/motion
				// unavailable) - keep retrying within the budget.
			}
			if (++attempts < 80) this._rasterTimer = setTimeout(tryAttach, 50);
		};
		this._rasterTimer = setTimeout(tryAttach, 0);
		this._track(() => clearTimeout(this._rasterTimer));
	}

	isHidden(hide){
		if (hide){
			this.res.style.display = "none";
		}
	}

	// Nodality dark-mode hook.
	// Usage: .theme({ light: {color: "#111", background: "#fff"},
	//                 dark:  {color: "#eee", background: "#111"} })
	// Or:    .set({ theme: {...same shape...} })
	// Listens for "nodality:theme" events on document and re-applies inline styles.
	theme(map){
		if (!map || typeof map !== "object") return this;
		this._themeMap = map;
		this._applyTheme(Theme.mode);
		if (!this._themeUnsub) {
			this._themeUnsub = Theme.subscribe((mode) => this._applyTheme(mode));
		}
		return this;
	}

	// Register a teardown callback. Everything this component attaches to a
	// long-lived target (window, document, an observer, the GPU pipeline)
	// should go through _track/_on so destroy() can actually release it.
	_track(fn){
		if (typeof fn !== "function") return fn;
		(this._disposables || (this._disposables = [])).push(fn);
		return fn;
	}

	// addEventListener + automatic removal on destroy(). Element-level
	// listeners are collected with the element, but window/document ones
	// outlive it and pin the component (and its DOM subtree) forever.
	_on(target, type, handler, opts){
		if (!target || typeof target.addEventListener !== "function") return handler;
		target.addEventListener(type, handler, opts);
		this._track(() => target.removeEventListener(type, handler, opts));
		return handler;
	}

	// Tear down everything this component attached: theme subscription, the
	// raster GPU pipeline, window/document listeners and observers. Call it
	// when removing a component from the DOM in a long-lived app.
	//
	// Previously this released only the theme subscription, so each mounted
	// component leaked its resize/scroll handlers and — for raster elements —
	// an entire WebGL context, RAF loop and two observers. raster-ops has had
	// a complete destroy() all along; nothing ever called it.
	destroy(){
		if (typeof this._themeUnsub === "function") {
			this._themeUnsub();
			this._themeUnsub = null;
		}

		if (this._rasterHandle && typeof this._rasterHandle.destroy === "function") {
			try { this._rasterHandle.destroy(); } catch (e) { /* already gone */ }
		}
		this._rasterHandle = null;
		this._rasterCancelled = true;

		if (this._disposables) {
			for (const off of this._disposables) {
				try { off(); } catch (e) { /* keep draining */ }
			}
			this._disposables.length = 0;
		}
		this._responsiveTasks = null;
		this._responsiveHandler = null;

		if (this.res && this.res.parentNode) {
			this.res.parentNode.removeChild(this.res);
		}
		return this;
	}

	_applyTheme(mode){
		if (this._noTheme || !this.res) return;

		// Explicit per-component map wins outright.
		if (this._themeMap) {
			const styles = this._themeMap[mode];
			if (!styles) return;
			for (const k in styles) {
				this.res.style[k] = styles[k];
			}
			return;
		}

		// Fallback: Theme.defaults. Only fill in properties the user hasn't
		// already set inline, so user styles always win.
		//
		// Snapshot is taken lazily, per-key, the first time each key shows up
		// in Theme.defaults. This matters because Theme.setDefaults() can be
		// called AFTER components are constructed; when a new key appears we
		// capture the current inline style (which still reflects what the
		// user set in .set({...})) before applying any default.
		const defaults = Theme.defaults && Theme.defaults[mode];
		if (!defaults) return;
		if (!this._themeOriginal) this._themeOriginal = {};
		for (const k in defaults) {
			if (!(k in this._themeOriginal)) {
				this._themeOriginal[k] = this.res.style[k] || "";
			}
			if (this._themeOriginal[k]) continue; // user set this — never touch
			this.res.style[k] = defaults[k];
		}
	}

	// Custom properties. `style[name]` does not work for them — the CSSOM
	// only reaches a `--*` property through setProperty — which is why an
	// axis default written like every other style silently did nothing.
	vars(map){
		if (!map || typeof map !== "object") return this;
		for (const name in map) {
			this.res.style.setProperty(name, String(map[name]));
		}
		return this;
	}

	keySet(obj){
		this.temporaryVal = 1;
		if (Array.isArray(obj)) {
			for (let i = 0; i < obj.length; i++) {
				if (obj[i] && obj[i].key != null) {
					this.res.style[obj[i].key] = obj[i].value;
				}
			}
			return this;
		}
		this.res.style[obj.key] = obj.value;
		return this;
	}

	// 08/10/2025

	/*
	id (in super class)
	pad, mar
	respad, resmar
	resprop, hover
	exact, zIndex,
	position, top,
	hover, size,
	width, maxWidth,
	height, maxHeight,

	*/
		commonMethods(obj){ // define in anim

  // Map of obj keys → style properties
  // Extended 2026-04-27 — first-class CSS props so callers don't need keySet.
  // Categories: positioning, flex-item, grid, typography, shadows/effects,
  // overflow, sizing, pointer/selection.
    const styleMap = {
        // ── Typography / sizing (pre-existing) ─────────────────────────
        exact: "fontSize",
        cursor: "cursor",
        width: "width",
        maxWidth: "maxWidth",
        height: "height",
        maxHeight: "maxHeight",
        radius: "borderRadius",
        lineHeight: "lineHeight",
        background: "background",
        // `color` was missing while `background` was present, so a
        // component that styles itself ONLY through commonMethods could be
        // given a background but not a text colour. Picker was exactly
        // that: `new Picker().set({ color: "#0d1117" })` silently did
        // nothing and the <select> fell back to the browser's black, while
        // a TextField beside it — which handles obj.color itself — took
        // the colour. The two rendered differently from identical options.
        //
        // Components that already handle obj.color (Text, Link, Image,
        // Wrapper, Button) now simply set the same property to the same
        // value. Containers that never handled it (FlexGrid, FlexRow,
        // Center, UList) gain it, where it was previously a silent no-op.
        color: "color",
        font: "fontFamily",
        opacity: "opacity",
        gap: "gap",
        minHeight: "minHeight",

        // ── Positioning ────────────────────────────────────────────────
        position: "position",
        inset: "inset",
        top: "top",
        right: "right",
        bottom: "bottom",
        left: "left",
        zIndex: "zIndex",

        // ── Flex item / wrapping ───────────────────────────────────────
        flex: "flex",
        flexShrink: "flexShrink",
        flexGrow: "flexGrow",
        flexBasis: "flexBasis",
        flexWrap: "flexWrap",
        alignSelf: "alignSelf",
        // `display` accepts any value: "inline-flex", "grid", "block", etc.
        display: "display",

        // ── Grid ───────────────────────────────────────────────────────
        gridTemplateColumns: "gridTemplateColumns",
        gridTemplateRows: "gridTemplateRows",
        rowGap: "rowGap",
        columnGap: "columnGap",
        // Extended 2026-08-11 — the shell vocabulary `bones` speaks, so a
        // generated grid needs no keySet. `cols`/`rows` are short names for
        // the two above; `areas` had no option at all, and `area` existed
        // only on the three components that happened to dispatch it
        // themselves (Wrapper, Text, Image) — those now set the same
        // property to the same value, and everything else gains it.
        //@ cols: grid-template-columns, verbatim — e.g. "240px 1fr".
        cols: "gridTemplateColumns",
        //@ rows: grid-template-rows, verbatim.
        rows: "gridTemplateRows",
        //@ areas: grid-template-areas, verbatim — e.g. '"nav main" "nav main"'.
        areas: "gridTemplateAreas",
        //@ area: This element's grid-area — the name of a cell declared in the parent's `areas`.
        area: "gridArea",

        // ── Typography (extended) ──────────────────────────────────────
        letterSpacing: "letterSpacing",
        textTransform: "textTransform",
        whiteSpace: "whiteSpace",
        // Wrapping behaviour for long words. `overflowWrap: "break-word"` (or
        // "anywhere") lets a label that's longer than its flex-shrunken cell
        // break mid-word instead of overflowing horizontally.
        overflowWrap: "overflowWrap",
        wordBreak: "wordBreak",
        wordWrap: "wordWrap",

        // ── Shadows / effects ──────────────────────────────────────────
        boxShadow: "boxShadow",
        backdropFilter: "backdropFilter",
        WebkitBackdropFilter: "WebkitBackdropFilter",

        // ── Overflow ───────────────────────────────────────────────────
        overflow: "overflow",
        overflowX: "overflowX",
        overflowY: "overflowY",
        WebkitOverflowScrolling: "WebkitOverflowScrolling",
        WebkitTapHighlightColor: "WebkitTapHighlightColor",

        // ── Sizing (extended) ──────────────────────────────────────────
        minWidth: "minWidth",
        boxSizing: "boxSizing",

        // ── Pointer / selection ────────────────────────────────────────
        pointerEvents: "pointerEvents",
        userSelect: "userSelect",
        WebkitUserSelect: "WebkitUserSelect",

        // ── Convenience extras ─────────────────────────────────────────
        // textAlign here lets non-Text classes (Wrapper, FlexRow) align
        // child text without falling through to keySet. Text already
        // exposes `align` separately.
        textAlign: "textAlign",
        transition: "transition",
    };

    // Apply styles safely
    for (const key in styleMap) {
        if (obj[key] != null) {
            this.res.style[styleMap[key]] = obj[key];
        }
    }

    // `transform` is overloaded: a string is a plain CSS transform, an
    // object is a Nodality animation descriptor handled by reactOnTransform
    // (called further below). Strings are applied here so they reach the
    // DOM without going through the animation system.
    if (typeof obj.transform === "string") {
        this.res.style.transform = obj.transform;
    }
//alert(obj.respad);
    // Special methods
    //@ pad: Padding. An array of side objects: `pad: [{a: 40}]`. Keys are `a` all, `t` top, `r` right, `b` bottom, `l` left. Keys combine, so `{tb: 12}` sets top and bottom. A bare number is treated as px; any string is passed through, so `{a: "2rem"}` works.
    obj.pad && this.pad(obj.pad);
    //@ mar: Margin. The same array-of-side-objects form as `pad`: `mar: [{a: 40}]`, keys `a t r b l`, combinable. Additionally `mar: "center"` sets left and right to auto, as does `{a: "auto"}` or `{center: true}`.
    obj.mar && this.mar(obj.mar);
    //@ respad: Responsive padding — per-breakpoint overrides of `pad`, in the same form.
    obj.respad && this.respad(obj.respad);

    // `borderObj` was never dispatched from here, so a component with no
    // handler of its own — TextField, Picker, Button, Image, Center —
    // silently ignored it in set(). The only other place it is applied is
    // inside hover(), which means it appeared to work on components that
    // happened to declare a hover and to do nothing on those that did not.
    //
    // Callers had to reach for the method instead:
    //     new Picker().set({ ... }).borderObj({ width: "1px", color: LINE })
    // which is why the Relays form controls chain it rather than passing
    // it with everything else.
    //
    // Guarded on `width` deliberately. Wrapper also accepts a shorthand
    // `borderObj: { a: "1px solid #eee" }` that it handles itself; that
    // shape has no width, and passing it to Animator.borderObj would build
    // "undefined solid undefined". Requiring width means only the
    // {width, color} form is handled here and the shorthand is left to the
    // component that understands it. Components that already apply this
    // option set the same property to the same value, so it stays
    // idempotent for them.
    //@ borderObj: Border as {width, color, type?, radius?}. Width carries its unit, e.g. "1px".
    obj.borderObj && obj.borderObj.width && this.borderObj(obj.borderObj);
    //@ resmar: Responsive margin — per-breakpoint overrides of `mar`, in the same form.
    obj.resmar && this.resmar(obj.resmar);
    //@ hover: Styles applied on hover, e.g. {color, background, animation: "0.2s ease"}.
    obj.hover && this.hover(obj.hover);
    //@ size: Fluid type scale step (S1…S6) — font size that scales with the viewport.
    obj.size && this.fluidCopy(obj.size);
    //@ resprop: Per-breakpoint style overrides — [{breakpoint, ...css}]. `exact` is font size.
    obj.resprop && this.resprop(obj.resprop, obj);
    //@ vars: Custom CSS properties on this element — {"--nod-split": 0.2}. Custom properties inherit, so writing them on a root drives its whole subtree with one declaration; that is how the morph axes reach every generated element without a stylesheet.
    obj.vars && this.vars(obj.vars);
    //@ keySet: Escape hatch — {key, value} written straight to element.style, or an array of them.
    obj.keySet && this.keySet(obj.keySet);
    //@ noTheme: Opt this element out of Theme.setDefaults light/dark colouring.
    obj.noTheme && (this._noTheme = true);
    //@ theme: Explicit light/dark overrides — {light: {...}, dark: {...}}.
    obj.theme && this.theme(obj.theme);
    //@ hide: Hide the element without removing it from the tree.
    obj.hide && this.isHidden(obj.hide);
    //@ raster: Attach a WebGL raster pipeline. Array of op nodes; see the Raster section.
    obj.raster && this.rasterize(obj.raster);

  //@ center: Centres this element's CHILDREN. `true` for both axes, `"x"` horizontal, `"y"` vertical. Axis-aware: in a flex column `"y"` is justify-content, in a row it is align-items; a grid uses justify-items/align-items. To centre the element itself inside its parent, use `mar: "center"`.
    // Dispatched here rather than per component, so it means the same thing
    // on all of them. It was wired only into Wrapper before, while other
    // components either had their own copy with a different meaning or no
    // centring at all.
    obj.center && this.center(obj.center, {display: obj.disp || obj.display, flexDirection: obj.flexDir || obj.flexDirection});
	// Only route to the animation system for object-shaped transforms.
	// String transforms are applied above via the styleMap path.
 //@ transform: A CSS transform string applied verbatim, or an object handled by reactOnTransform(). Composed with `scale` when both are given.
	(obj.transform && typeof obj.transform === "object") && this.reactOnTransform(obj.transform);

	(obj.opacity !== undefined) && (this.res.style.opacity = obj.opacity);

    // Font weight handling
    if (obj.bold) {
        this.res.style.fontWeight = "bold";
    } else if (obj.weight != null) {
        this.res.style.fontWeight = obj.weight;
    }

	

			return this;
	}

	 hover(obj){
		


		if (obj.border){
			//alert("IHO")
			// // console.log("BORDERA IS ");
			// // console.log(obj.border);

			let w = obj.border.width;
			this.res.style.border = w ? `${w}px solid transparent` : "1px solid transparent";

		}


		let bops = this.options && this.options.borderObj;

		if (bops){
			//alert("PP")
			this.res.style.border = `${bops.width}px solid ${bops.color}`;
		}
		
        this.prevColor = this.res.style.backgroundColor;
		this.foreColor = this.res.style.color;
		this.prevBorder = this.res.style.border;
		this.prevBoxShadow = this.res.style.boxShadow;


  

	
		if (obj.animation) {

			this.res.style.transition = `${obj.animation}`; //`${obj.animation}s ease-in-out`; // stop resize ???
			// This used to be misspelled `transionProperty`, which CSSOM
			// silently discards — so the shipped behaviour was the shorthand's
			// default, `all`. Fixing the spelling narrows what animates, so the
			// list has to name every property hover() actually changes
			// (see the onmouseover/onmouseout handlers below) or those would
			// start snapping instead of easing.
			this.res.style.transitionProperty =
				`background-color, color, border, box-shadow, transform`;
		}

		// remember the pre-hover transform so scale-on-hover can be undone cleanly
		this.prevTransform = this.res.style.transform;

        this.res.onmouseout = () => {
		//	alert("OJHOIH")
			this.res.style.backgroundColor = `${this.prevColor}`;
			this.res.style.color = `${this.foreColor}`;
		    this.res.style.border = this.prevBorder;
		    if (obj.scale != null || obj.transform != null) {
		        this.res.style.transform = this.prevTransform || "";
		    }
		    if (obj.boxShadow != null) {
		        this.res.style.boxShadow = this.prevBoxShadow || "";
		    }


			
			
			
		}
        
        this.res.onmouseover = () => {
			//alert("OJHOIH")
		//	alert(obj.background);
			this.res.style.color = obj.color;
			this.res.style.backgroundColor = obj.background;

			if (obj.border){
				//alert("IHO")

				let w = obj.border.width;
				let color = obj.border.color ?? "#2ECC71";
				//console.log("WO", w, color);
				//alert(obj.border.color);
				this.res.style.border = w ? `${w}px solid ${color}` : "1px solid #2ECC71";
			}

			if (obj.scale != null || obj.transform != null) {
				const base = this.prevTransform ? `${this.prevTransform} ` : "";
				const parts = [];
				if (obj.transform != null) parts.push(obj.transform);
				if (obj.scale != null) parts.push(`scale(${obj.scale})`);
				this.res.style.transform = `${base}${parts.join(" ")}`;
			}

			if (obj.boxShadow != null) {
				this.res.style.boxShadow = obj.boxShadow;
			}

				
			//}

			// // // console.log(`OVER: ${obj.background}`);
		}
        
        return this;
    } // hover from Link central
    
	
	onScroll(data){
		const parseUnit = (val) => {
			if (val == null) return { num: 0, unit: "px" };
			const m = String(val).match(/^(-?[\d.]+)(.*)$/);
			return m ? { num: parseFloat(m[1]), unit: m[2] || "px" } : { num: 0, unit: "px" };
		};

		const applyTrn = (valObj) => {
			const tx = valObj && valObj.tx != null ? valObj.tx : "0px";
			const ty = valObj && valObj.ty != null ? valObj.ty : "0px";
			this.res.style.transform = `translate3d(${tx}, ${ty}, 0)`;
		};

		// Set the element valMin offset on page load
		if (data.value === "opacity") {
			this.res.style.opacity = data.valMin;
		} else if (data.value === "scale") {
			this.res.style.transform = `scale(${data.valMin})`;
		} else if (data.value === "trn") {
			applyTrn(data.valMin);
		}

		const compute = () => {
			if (data.value === "trn") {
				const result = {};
				const axes = ["tx", "ty"];
				for (let i = 0; i < axes.length; i++) {
					const k = axes[i];
					const hasMin = data.valMin && data.valMin[k] != null;
					const hasMax = data.valMax && data.valMax[k] != null;
					if (hasMin || hasMax) {
						const a = parseUnit(hasMin ? data.valMin[k] : (hasMax ? data.valMax[k] : "0px"));
						const b = parseUnit(hasMax ? data.valMax[k] : (hasMin ? data.valMin[k] : "0px"));
						const num = this.smartRange(window.scrollY, {
							min: data.from,
							max: data.to
						}, {
							min: a.num,
							max: b.num
						});
						result[k] = `${num}${a.unit}`;
					}
				}
				applyTrn(result);
				return;
			}

			let resa = this.smartRange(window.scrollY, {
				min: data.from,
				max: data.to
			}, {
				min: data.valMin,
				max: data.valMax
			});

			if (data.value === "opacity") {
				this.res.style.opacity = resa;
			} else if (data.value === "scale") {
				this.res.style.transform = `scale(${resa})`;
			}
		};

		this._on(window, "scroll", compute);

		// Fire at the beginning if user sets "from" value to 0
		if (data.from === 0) {
			compute();
		}
	}


	setAny(obj){
		this[Object.keys(obj)[0]] = [Object.values(obj)[0]];
	}

	setID(id){
		this.id = id;
	}

	setPrevText(prevText){ // 12:12:43 20/03/25 OK :)
		this.prevText = prevText;
	}


	// [{ breakpoint: "sm" , values: [...]}]


/**
 * @private
 * Sets up the single resize listener and runs all registered tasks.
 */

/**
 * @private
 * Sets up the single resize listener and runs all registered tasks.
 * Ensures setup logic runs only ONCE.
 */
_setupResponsiveManager() {
    // 1. Initialize tasks list if it doesn't exist
    this._responsiveTasks = this._responsiveTasks || [];

    // 2. Define the reactor function
    const react = () => {
        this._responsiveTasks.forEach(taskFn => {
            taskFn();
        });
    };

    // 3. Setup Event Listener (ONLY ONCE)
    // We check if the handler is already assigned to avoid duplicate listeners
    if (!this._responsiveHandler) {
        this._responsiveHandler = react;
        this._on(window, "resize", react);
    }

    // 4. Trigger Execution (ALWAYS)
    // We run this every time this function is called (by resprop or respad)
    // to ensure the newly added task is executed immediately.
    setTimeout(() => {
        react();
    }, 0);
}


resprop(arr, op) {

	// alert(op);
	this.options = op;

    // --- 1. CONFIGURATION & NORMALIZATION ---
    const breakpoints = {
        default: [0, 100000], xs: [0, 575], sm: [576, 767], md: [768, 991],
        lg: [992, 1199], xl: [1200, 1399], xxl: [1400, 100000]
    };
    const excludedKeys = ['resprop', 'breakpoint', 'value', 'values', 'range'];

    // Shorthand → CSSOM property names. Values are written with
    // `element.style[prop] = …`, which silently discards any key that is not a
    // real CSSOM property — so `flexDir: "column"` used to do nothing at all,
    // with no error. Map the shorthands people actually write, and warn on
    // anything else that is neither a CSSOM property nor an internal method.
    const PROP_ALIASES = {
        flexDir: "flexDirection",
        dir: "flexDirection",
        justify: "justifyContent",
        align: "alignItems",
        wrap: "flexWrap",
        bg: "background",
        radius: "borderRadius",
        z: "zIndex",
        // `exact` is THE alias for font size in set() across every
        // component, so writing it inside a resprop breakpoint is the
        // natural thing to do — and it was silently dropped, warning that
        // a first-class Nodality key "is not a CSS property". One key
        // meaning fontSize in set() and nothing in resprop is the bug.
        exact: "fontSize",
    };

    const resolveProp = (key) => {
        const mapped = PROP_ALIASES[key] || key;
        if (
            typeof console !== "undefined" &&
            typeof this[key] !== "function" &&
            !(mapped in this.res.style)
        ) {
            console.warn(
                `[nodality] resprop: "${key}" is not a CSS property or component method — ignored.` +
                (PROP_ALIASES[key] ? "" : ` Did you mean one of: ${Object.keys(PROP_ALIASES).join(", ")}?`)
            );
        }
        return mapped;
    };

    // A. Normalize ranges: Treat "800px" as [0, 800] (Max-Width logic)
    arr.forEach(item => {
        if (breakpoints[item.breakpoint] !== undefined) {
            item.range = breakpoints[item.breakpoint];
        } else if (Array.isArray(item.breakpoint) && item.breakpoint.length === 2) {
            item.range = [
                parseInt(item.breakpoint[0], 10), 
                parseInt(item.breakpoint[1], 10)
            ];
        } else {
            // "800px" now becomes [0, 800]
            item.range = [0, parseInt(item.breakpoint, 10)];
        }
    });

    // B. SORTING: Sort by MAX value ascending. 
    // This ensures that if width is 500px, "800px" is checked before "1060px".
    arr.sort((a, b) => a.range[1] - b.range[1]);

    // C. Ensure the default/fallback is present
    let defaultItem = arr.find(item => item.breakpoint === "default");
    if (!defaultItem) {
        defaultItem = { breakpoint: "default", range: breakpoints.default };
        arr.unshift(defaultItem);
    }
    
    // --- 2. STATE CAPTURE ---

    // NOTE: the full-style snapshot that used to live here (this.prevStyles)
    // was write-only — the only readers are in commented-out earlier versions
    // of resprop below. It walked every CSSOM property on every resprop() call
    // for nothing, so it has been dropped.

    const responsiveProps = new Set();
    arr.forEach(bp => {
        Object.keys(bp).forEach(key => {
            if (!excludedKeys.includes(key) && key !== 'range') {
                responsiveProps.add(key);
            }
        });
    });

    // Fill defaultItem with fallback values
    responsiveProps.forEach(key => {
        if (defaultItem[key] === undefined) {
             defaultItem[key] = this.options[key] || "initial";
        }
    });

    // --- 3. CORE LOGIC ---
    const respropTask = () => {
        const width = Animator.viewportWidth();
        let applied = defaultItem; 

        // 1. Find the first matching range. 
        // Because we sorted ascending, the smallest matching "max-width" wins.
        for (let i = 0; i < arr.length; i++) {
            const bp = arr[i];
            const [min, max] = bp.range;
            if (bp.breakpoint === "default") continue;

            if (width >= min && width <= max) {
                applied = bp;
                break;
            }
        }
        
        // --- Apply Styles ---
        
        // B. Reset: Apply base values first
        responsiveProps.forEach(key => {
            // Special handling for keySet during reset
            if (key === 'keySet') {
                const ks = defaultItem[key];
                if (ks && ks.key) this.res.style[ks.key] = ks.value;
            } else {
                this.res.style[resolveProp(key)] = defaultItem[key];
            }
        });

		
        
        // C. Overrides: Apply matching breakpoint values
        for (const key in applied) {

			// `exact` is a font-size. It used to call this.set(applied) —
			// re-entering the component's whole set() pipeline (re-registering
			// hover handlers, re-parsing every option) on EVERY resize event.
			// Apply the property directly instead.
			if (key === "exact"){
				this.res.style.fontSize = applied[key];
				continue;
			}


            if (!excludedKeys.includes(key) && key !== 'range') {
                const value = applied[key];

                // NEW: Handle your keySet object {key: "...", value: "..."}
                if (key === 'keySet' && value && value.key) {
                    this.res.style[value.key] = value.value;
                } 
                // Handle internal methods (e.g., this.width("300px"))
                else if (typeof this[key] === 'function') {
                    this[key](value);
                }
                // Handle direct CSS property assignment
                else {
                    this.res.style[resolveProp(key)] = value;
                }


				
            }
        }
    };

    // --- 4. REGISTRATION ---
    this._responsiveTasks = this._responsiveTasks || [];
    this._responsiveTasks.push(respropTask);
    this._setupResponsiveManager(); 
}


respad(arr) {

    // --- 1. CONFIGURATION & NORMALIZATION ---
    const breakpoints = {
        default: [0, 100000], xs: [0, 575], sm: [576, 767], md: [768, 991],
        lg: [992, 1199], xl: [1200, 1399], xxl: [1400, 100000]
    };
    // Note: 'values' is handled specifically here, so it is not excluded globally.
    
    // A. Normalize breakpoints and assign range (handles named, [min, max], and "px" inputs)
    arr.forEach(item => {
        if (breakpoints[item.breakpoint] !== undefined) {
            item.range = breakpoints[item.breakpoint];
        } else if (Array.isArray(item.breakpoint) && item.breakpoint.length === 2) {
            item.range = [parseInt(item.breakpoint[0], 10), parseInt(item.breakpoint[1], 10)];
        } else {
            item.range = [parseInt(item.breakpoint, 10), 100000]; 
        }
    });

    // B. Sort by the minimum value of the range
    arr.sort((a, b) => a.range[0] - b.range[0]);

    // C. Find/Ensure the base style object
    let defaultItem = arr.find(item => item.breakpoint === "default");
    if (!defaultItem) {
        defaultItem = { breakpoint: "default", range: breakpoints.default };
        arr.unshift(defaultItem);
    }
    
    // --- 2. STATE CAPTURE & RESET PREPARATION ---

    // D. Ensure 'defaultItem' has a 'values' property, falling back to the base 'pad' option.
    // `this.options` is only populated by callReact()/resprop(), both of which
    // run AFTER commonMethods() dispatches here — so on components like Wrapper
    // it is still undefined at this point. Guard rather than throw: a missing
    // base `pad` simply means there is nothing to reset to.
    if (defaultItem.values === undefined) {
         defaultItem.values = (this.options && this.options.pad) || null;
    }


    // --- 3. CORE LOGIC: The Responsive Task Function ---
    const respadTask = () => {
        const width = Animator.viewportWidth();
        let applied = defaultItem; 

        // 1. RANGE LOGIC: Find the exact breakpoint whose range matches the current width.
        for (let i = 0; i < arr.length; i++) {
            const bp = arr[i];
            const [min, max] = bp.range;

            if (bp.breakpoint === "default") continue;

            if (width >= min && width <= max) {
                applied = bp;
                break;
            }
        }
        
        // --- Apply Pad Style ---
        
        // Determine the final padding value: use applied.values if it exists, otherwise defaultItem.values
        const finalPadValue = applied.values !== undefined ? applied.values : defaultItem.values;


        
        if (finalPadValue !== undefined && finalPadValue !== null) {
            // Note: We trust this.pad handles the style application and clearing
            this.pad(finalPadValue);
        }
    };


    // --- 4. REGISTRATION ---
    this._responsiveTasks = this._responsiveTasks || [];
    this._responsiveTasks.push(respadTask);
    
    // Ensure the unified handler is set up and starts listening
    this._setupResponsiveManager(); 
}


resmar(arr) {

    // --- 1. CONFIGURATION & NORMALIZATION ---
    const breakpoints = {
        default: [0, 100000], xs: [0, 575], sm: [576, 767], md: [768, 991],
        lg: [992, 1199], xl: [1200, 1399], xxl: [1400, 100000]
    };
    // Note: 'values' is handled specifically here, so it is not excluded globally.
    
    // A. Normalize breakpoints and assign range (handles named, [min, max], and "px" inputs)
    arr.forEach(item => {
        if (breakpoints[item.breakpoint] !== undefined) {
            item.range = breakpoints[item.breakpoint];
        } else if (Array.isArray(item.breakpoint) && item.breakpoint.length === 2) {
            item.range = [parseInt(item.breakpoint[0], 10), parseInt(item.breakpoint[1], 10)];
        } else {
            item.range = [parseInt(item.breakpoint, 10), 100000]; 
        }
    });

    // B. Sort by the minimum value of the range
    arr.sort((a, b) => a.range[0] - b.range[0]);

    // C. Find/Ensure the base style object
    let defaultItem = arr.find(item => item.breakpoint === "default");
    if (!defaultItem) {
        defaultItem = { breakpoint: "default", range: breakpoints.default };
        arr.unshift(defaultItem);
    }
    
    // --- 2. STATE CAPTURE & RESET PREPARATION ---

    // D. Ensure 'defaultItem' has a 'values' property, falling back to the base
    // `mar` option. Same ordering caveat as respad() — see the note there.
    if (defaultItem.values === undefined) {
         defaultItem.values = (this.options && (this.options.mar || this.options.pad)) || null;
    }


    // --- 3. CORE LOGIC: The Responsive Task Function ---
    const resmarTask = () => {
        const width = Animator.viewportWidth();
        let applied = defaultItem; 

        // 1. RANGE LOGIC: Find the exact breakpoint whose range matches the current width.
        for (let i = 0; i < arr.length; i++) {
            const bp = arr[i];
            const [min, max] = bp.range;

            if (bp.breakpoint === "default") continue;

            if (width >= min && width <= max) {
                applied = bp;
                break;
            }
        }
        
        // --- Apply Pad Style ---
        
        // Determine the final padding value: use applied.values if it exists, otherwise defaultItem.values
        const finalPadValue = applied.values !== undefined ? applied.values : defaultItem.values;


        
        if (finalPadValue !== undefined && finalPadValue !== null) {
            // Note: We trust this.pad handles the style application and clearing
            this.mar(finalPadValue);
        }
    };


    // --- 4. REGISTRATION ---
    this._responsiveTasks = this._responsiveTasks || [];
    this._responsiveTasks.push(resmarTask);
    
    // Ensure the unified handler is set up and starts listening
    this._setupResponsiveManager(); 
}


	/**
	 * Tells the caller they passed an option that no longer exists as the
	 * way to do this, and what to use instead.
	 *
	 * console.error only, deliberately. alert() is banned in live modules
	 * (see the "no live module calls alert()" invariant): alerts had sat in
	 * ordinary paths and blocked the page for every visitor, and the ban is
	 * worth more than making this one warning louder.
	 */
	color(color){
		this.res.style.color = color;
		return this;
	}

	onTap(handler){
		this.res.addEventListener("click", handler);
		return this;
	}

	setArea(area){
		this.res.style.gridArea = area;
		return this;
	}


	font(font){
		this.res.style.fontFamily = font;
		return this;
	}

	radius(v) {
		this.res.style.borderRadius = typeof v === "number" ? `${v}px` : v;
		return this;
	}

	width(percentage){
		this.res.style.width = percentage;
		return this;
	}

    scale(obj){
        
        let previousWidth = this.res.style.width;
          
        this.res.style.transition= "0.5s all";
      //  alert(previousWidth);
        
        this.res.addEventListener("mouseover", () => {
            let previousWidth = this.res.style.width;
             this.res.style.transform = "scale(1.04)";
        });
        
         this.res.addEventListener("mouseout", () => {
            let previousWidth = this.res.style.width;
              this.res.style.transform = "scale(1.0)";
        });
        
        
        return this;
    }

	round(v) {
		this.deprecatedOption("round()", "radius()");
		return this.radius(v);
	}

	toCSS(){
		return this.css; 
	}

	toHTMLA(){
		return this.html;
	}

	background(color){
		this.res.style.background = color;
		return this;
	}

	deprecatedOption(name, replacement) {
		console.error(`nodality: \`${name}\` is deprecated — use \`${replacement}\` instead.`);
		return this;
	}

	/**
		 * Centres this element's CHILDREN.
		 *
		 *   center: true    both axes
		 *   center: "x"     horizontally only
		 *   center: "y"     vertically only
		 *
		 * Replaces six overlapping methods — toCenter(), toCenter("both"),
		 * flexc(), toCol(), centerColumn and simpleCenter(). flexc() was
		 * byte-identical to toCenter() and toCol() to toCenter("both"), so the
		 * same behaviour had four names and the two that differed did so by
		 * one property each.
		 *
		 * To centre the element ITSELF inside its parent, that is `mar:
		 * "center"` — a different thing, and the reason the old names were so
		 * easy to confuse.
		 *
		 * Axis-aware rather than fixed. justify-content runs along the main
		 * axis, so in a flex column it is the VERTICAL one and align-items is
		 * horizontal — the opposite of a flex row. The old methods hardcoded
		 * flex-direction: column and so only ever worked one way round; this
		 * reads the direction already set and centres the axis you asked for.
		 * A grid gets justify-items/align-items instead, which is what
		 * simpleCenter() was reaching for without setting a display at all.
		 */
		center(axis = true, hint = {}){
			const s = this.res.style;
			// The hints matter because this runs from commonMethods, before a
			// component applies its own `disp`/`flexDir` aliases. Without them
			// center() sees a bare element, assumes a flex column, and puts the
			// centring on the wrong property for every row and grid.
			const display = s.display || hint.display || "";
			const direction = s.flexDirection || hint.flexDirection || "";
			const grid = display.includes("grid");
	
			const x = axis === true || axis === "both" || axis === "x";
			const y = axis === true || axis === "both" || axis === "y";
	
			if (grid){
				if (x){ s.justifyItems = "center"; s.justifyContent = "center"; }
				if (y){ s.alignItems = "center"; s.alignContent = "center"; }
				return this;
			}
	
			if (!display.includes("flex")) s.display = "flex";
			if (!s.flexDirection) s.flexDirection = direction || "column";
	
			const column = (s.flexDirection || "column").startsWith("column");
			const mainIsY = column;
	
			if (mainIsY ? y : x) s.justifyContent = "center";
			if (mainIsY ? x : y) s.alignItems = "center";
			return this;
		}

	isNumber(value) {
		return typeof value === 'number' && !isNaN(value);
	}

	// Single source of truth for "how wide is the viewport". See the note in
	// chainReact — visualViewport is preferred (it tracks pinch-zoom) but is
	// not universally present.
	static viewportWidth() {
		if (typeof window === "undefined") return 0;
		const vv = window.visualViewport;
		return (vv && typeof vv.width === "number") ? vv.width : window.innerWidth;
	}
 
	pad(arr){

		for(let i = 0; i < arr.length; i++) {
	
			let keys = Object.keys(arr[i]);
			for(let j = 0; j < keys.length; j++) {
				let key = keys[j];
				let value = arr[i][key];
				for(let k = 0; k < key.length; k++) {
					switch(key[k]) {
						case 'a':
							
							//alert("OIHOI")
							this.res.style.padding = this.isNumber(value) ? `${value}px` : value;
							break;
						case 't':
							this.res.style.paddingTop =  this.isNumber(value) ? `${value}px` : value;
							break;
						case 'l':
							this.res.style.paddingLeft =  this.isNumber(value) ? `${value}px` : value;
							break;
						case 'r':
							this.res.style.paddingRight =  this.isNumber(value) ? `${value}px` : value;
							break;
						case 'b':
							this.res.style.paddingBottom =  this.isNumber(value) ? `${value}px` : value;
							break;
						default:
							// console.log(`Invalid key: ${key[k]}`);
					}
				}
			}
		}
		return this;
	}


	as(asa){
		this.res.style.alignSelf = asa;
		return this;
	}


	mar(arr){

		// Shorthand: mar: "center" → margin: 0 auto
		if (arr === "center"){
			this.res.style.marginLeft = "auto";
			this.res.style.marginRight = "auto";
			return this;
		}

		for(let i = 0; i < arr.length; i++) {
			let keys = Object.keys(arr[i]);
			for(let j = 0; j < keys.length; j++) {
				let key = keys[j];
				let value = arr[i][key];
				for(let k = 0; k < key.length; k++) {
					switch(key[k]) {
						case 'a':
							// mar: [{ a: "auto" }] → margin: 0 auto (centers block-level elements)
							if (value === "auto"){
								this.res.style.marginLeft = "auto";
								this.res.style.marginRight = "auto";
							} else {
								this.res.style.margin = this.isNumber(value) ? `${value}px` : value;
							}
							break;
						case 't':
							this.res.style.marginTop = this.isNumber(value) ? `${value}px` : value;
							break;
						case 'l':
							this.res.style.marginLeft = this.isNumber(value) ? `${value}px` : value;
							break;
						case 'r':
							this.res.style.marginRight = this.isNumber(value) ? `${value}px` : value;
							break;
						case 'b':
							this.res.style.marginBottom = this.isNumber(value) ? `${value}px` : value;
							break;
						default:
							// console.log(`Invalid key: ${key[k]}`);
					}
				}

				// Per-entry shorthand: { center: true } → marginLeft/Right = auto
				if (key === "center" && value === true){
					this.res.style.marginLeft = "auto";
					this.res.style.marginRight = "auto";
				}

				// Value-based detection: if any value === "auto" on l/r/lr keys, force centering
				if (value === "auto" && (key.includes("l") || key.includes("r"))){
					if (key.includes("l")) this.res.style.marginLeft = "auto";
					if (key.includes("r")) this.res.style.marginRight = "auto";
				}
			}
		}
		return this;
	}


 smartRange(val, from, to) {

    if (val < from.min) {
        val = from.min;
    }

    if (val > from.max) {
        val = from.max;
    }

    let percent = (val - from.min) / (from.max - from.min);

    if (from.min > from.max) {
        percent = (val - from.max) / (from.min - from.max);
    }

    // Linear interpolation across the OUTPUT range. The old form added
    // |to.min| to to.max instead of subtracting it, so any range whose
    // minimum was above zero overshot: 0.2 -> 1 produced 0.2 + 1.2p = 1.4
    // at full scroll. Correct only when to.min <= 0, which is why the
    // 0 -> 1 demos never showed it.
    return to.min + (to.max - to.min) * percent;
}


	gpos(obj){
		//alert(obj.col);
		this.res.style.gridColumn = obj.col;
		this.res.style.gridRow = obj.row;
		return this;
	  }

	fluidCopy(name){


		if (name instanceof Object){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h1");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = name.exact;

			 // alert(name.exact);

			return this;
		}
        
        const display1 = "calc(1.625rem + 5.075vw)";
        
        if (name === "S1"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h1");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display1;
        }
         
        const display2 = "calc(1.500rem + 4.3vw)";
        
        if (name === "S2"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h2");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display2;
        }
        
        
        const display3 = "calc(1.375rem + 3.525vw)";
        
        if (name === "S3"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h3");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display3;
        }

		const display4 = "calc(1.250rem + 2.75vw)";
        
        if (name === "S4"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h4");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display4;
        }

		const display5 = "calc(1.125rem + 1.975vw)";
        
        if (name === "S5"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h5");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
            this.res.style.fontSize = display5;
        }


		const display6 = "calc(1rem + 0.5vw)"; // calc(1rem + 1.2vw)
        
        if (name === "S6"){
             this.res.style.fontSize = display6;
        }
        
              return this;
    }


	
    
    setIndex(idx){
		this.index = idx;
	}

	borderObj(options){
		let type = options.type ?? "solid";
		this.res.style.border = `${options.width} ${type} ${options.color}`
		// Only touch borderRadius when the caller actually provided one.
		// Otherwise we'd clobber the radius set via the styleMap (e.g.
		// `radius: "50%"` on a circle) with `undefined`, which clears it.
		if (options.radius !== undefined) {
			this.res.style.borderRadius = options.radius;
		}
		return this;
	}
    


setPref(id){
	this.preffersId = id;
}


setClass(id){
	this.class = id;
}


  //--------- START OF INDEPENDENT


// React without condition 
// loop through queries 
// to make all CSS immediatelly...

setTags(obj){
	//alert("TAGS SET")
	this.openTag = obj.open;
	this.closeTag = obj.close;

}

  chainReact(queries, id, keep) { // we use this

	this.ap = false;
	this.cta = 0;
	this.once = false;


	// REPLACE WITH DEFAULT RANGE INSIDE FOR LOOP IF NONE IS FOUND 
	// FOR LET QUEYR OF Q
	// if !q.range => q.range = ["0px", "99999px"]
	for (let q of queries){
		if (!q.range){
			// console.log("NOPA");
			q.range = ["0px", "999999px"];
		}
	}

	queries.sort((a, b) => parseInt(a.range[0]) - parseInt(b.range[0]));
  
	// Function to check and log queries based on screen size
	const checkQueries = (qban) => {
		//alert("/P")
	  // One width source for the whole library. visualViewport is absent in
	  // jsdom and older WebViews (TypeError), and disagrees with innerWidth
	  // during pinch-zoom — which used to make chainReact breakpoints flip at
	  // different widths than resprop/respad breakpoints on the same page.
	  const screenSize = Animator.viewportWidth();
	  let ops = "";
	  let operations = [];
	  let globalQueries = [];

	  this.resCopy = this.res;

	  this.storedQueries = queries.map(el => el.target).filter(el => el != undefined);
  
	  for (const query of queries) {
		this.counterIndex++;

		const [startRange, endRange] = query.range;
		const startSize = parseInt(startRange);
		const endSize = parseInt(endRange);
		let all = true;

		if (query.target){

			all = false;


			for (var i = 0; i < query.target.length; i++){

				if (query.target[i] === id){ // #id is required
				
					all = true;
				}
			}
		} 
  
		if (screenSize >= startSize && screenSize <= endSize && all) { // NEED TO COMMENT ALL
		  operations.push(query.log);
		  globalQueries.push(query);

		  if (query.op && query.op.margin){
			this.useMargin = query.op.margin;
		  }

		} 

	  }


	  if (keep && !keep.includes("background")){
		this.res.style.background = "";
		this.res.style.backgroundColor = "";
	  }
	 
	 
	  this.res.style.textShadow = "";

	  if (keep && !keep.includes("border")){
		this.res.style.border = "";
	  }


	  if (keep && !keep.includes("margin")){
		this.res.style.margin = "";
	  }
	

	  this.res.style['-webkit-text-fill-color'] = '';
	  this.res.style['-webkit-text-stroke-color'] = "";
	  this.res.style['-webkit-text-stroke-width'] = "";
	  this.res.style.filter = "";
	 
	 


	
 if (this.options.background){

		 this.res.style.background = this.options.background; 
	  } else {
				//alert("/")
				//console.log("///-Hello-///")
	  }
	 // }
	  
	 
	 
	  //"";
	  //}

if (operations.includes("gradient")){
//	alert("IHOIH")
}
	  // NO CONITION, ALWAYS!!!!
	  if (operations.includes("gradient") || operations.includes("shadow")){
			this.res.style.position = "relative";
			// Navigation might go over it give nav higher zIndex
	  } // FIX 23:31:56 10/11/24

	

	  if (operations.includes("blast")){
		
		let gl = globalQueries.filter(x => x.log === "blast")[0].op.color;
		// console.log(gl);

		let w = globalQueries.filter(x => x.log === "blast")[0].op.width ?? "1px";
	

		if (this.getType() === "FlexRowLayoutElement" || this.getType() === "LayoutWrapperElement"){
			// alert("///")
			//alert(`${w}px solid orange`);
			this.res.style.border = `${typeof w === 'number' ? w + 'px' : w} solid orange`;
 this.res.style.display = "inline-block"; // or block
		if (this.getType() === "FlexRowLayoutElement"){
			this.res.style.display = "flex";
		}

    this.res.style.boxSizing = "border-box";
    this.res.style.transformOrigin = "center"; // makes rotations/translations look correct
	this.blastTarget = this.res;
} else {
			if (this.text){

			
			}
			this.res.style['-webkit-text-fill-color'] = 'transparent';
	
			this.res.style['-webkit-text-stroke-color'] =  gl;//"orange";
			this.res.style['-webkit-text-stroke-width'] = `${w}`;
			//alert("HIOH")
		}
	  }

	  if (operations.includes("filter")){
		let w = globalQueries.filter(x => x.log === "filter")[0]
		// console.log(w);
		let filterName = w.op.filter;
			this.res.style.filter = filterName;
	  }

	  if (operations.includes("background")){
		this.res.style.backgroundColor = "green";
	 }

	  if (operations.includes("gradient") && this.globalGradient){
		// not working with blast

		// Children are cleared when setting gradient to wrap and resizing

		// FAIL CLOSED on `this.globalGradient`. It is read from the node's
		// `op.gradient`, so a design node that names the op but carries no
		// gradient string leaves it undefined — and the transparent
		// text-fill below then paints the element out with NOTHING behind
		// it, so the target goes invisible rather than merely unstyled.
		// That is not hypothetical: the README's own install example wrote
		// the colours as a top-level `colors:` key, which nothing reads,
		// and so rendered its own headline invisible through several
		// releases. Leaving the element untouched makes the same mistake
		// visible as "no gradient" instead of as a blank page.

	    // Set gradient to text
		if (this.getType() !== "LayoutWrapperElement" && this.getType() !== "FlexRowLayoutElement"){
			this.res.style['-webkit-text-fill-color'] = 'transparent';
		}

		// globalGradient is set in element "set" method
		this.res.style.background = this.globalGradient;// "linear-gradient(to left, #3498db, #1abc9c)";
		
		
	//	console.log("LGT");
		if (this.getType() !== "LayoutWrapperElement" && this.getType() !== "FlexRowLayoutElement" ){
		// alert("OJIOJIOIO")
			this.res.style['background-clip'] = 'text'; // 19:23:05 05/05/2024 -webkit was a problem here!
		}
	
		

		// In Safari background linear gradient sets background-clip to border-box; this ai automatically put after		
	
	}

	
	  if (operations.includes("shadow")){
const { op } = this.options.shadow;

const steps = op.steps ?? 1;
const colors = op.colors ?? ["gray"];
let movements = op.movements ?? ["3px", "3px"];
const radius = op.radius ?? "3px";

// If movements only contains one value, duplicate it for x and y
if (movements.length === 1) {
  movements = [movements[0], movements[0]];
}

if (this.getType() === "FlexRowLayoutElement" || this.getType() === "LayoutWrapperElement") {
  // use box-shadow for layout containers
  const shadowParts = [];
  for (let i = 0; i < steps; i++) {
    const color = colors[i] ?? colors[0];
    const offsetX = movements[0];
    const offsetY = movements[1];
    shadowParts.push(`${offsetX} ${offsetY} ${radius} ${color}`);
  }
  this.res.style.boxShadow = shadowParts.join(", ");
} else {
  // use drop-shadow for other element types (e.g., text, images)
  const filters = [];
  for (let i = 0; i < steps; i++) {
    const color = colors[i] ?? colors[0];
    const offsetX = movements[0];
    const offsetY = movements[1];
    filters.push(`drop-shadow(${offsetX} ${offsetY} ${radius} ${color})`);
  }
  this.res.style.filter = filters.join(" ");
}


			//} else {
				
				
	//	}
	  }

	  if (operations.includes("margin")){
		for (var i = 0; i < queries.length; i++){
			if (!queries[i].op){
				continue;
			}
			
			const off  = queries[i].op.offsets;
			
			if (off && this.index !== undefined){
				this.res.style.margin = off[Number(this.index)] + "px";
			}
		}
  }


	if (operations.includes("spana") || operations.includes("span")) {

	const overlay = document.createElement("div");
	overlay.setAttribute("id", "oroa");
Object.assign(overlay.style, {
  position: "absolute",
  inset: "0",
  background: "linear-gradient(90deg, rgb(52,152,219), rgb(26,188,156))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  pointerEvents: "none",
});


		// 🛑 prevent re-creating spans on resize
  if (this.res && this.res.querySelector('span')) return;

  
    this.res = this.resCopy;
    this.res.textContent = ""; // clear current content

    if (this.options.span) {
        let spansArray = Array.isArray(this.options.span)
            ? this.options.span
            : [this.options.span]; // wrap single span in array

        spansArray.forEach(spanObj => {
            if (spanObj.op && spanObj.op.name === "span" && Array.isArray(spanObj.op.parts)) {
                let cursor = 0;
                const fullText = this.prevText || "";

                spanObj.op.parts.forEach(part => {
                    const partText = part.text;
 let opts = part.style || {};
                    // 1️⃣ Append any text before this span
                    if (cursor < fullText.length) {
                        const index = fullText.indexOf(partText, cursor);
                        if (index > cursor) {
                            const plainText = fullText.substring(cursor, index);
                            this.res.appendChild(new this.constructor(plainText).setup({type: "span", id: opts.id, animation: opts.animation}).set({}).render());
                        }
                        cursor = index + partText.length;
                    }

                    // 2️⃣ Append the styled span part
                   
                    let spanEl = new this.constructor(partText).setup({type: "span", id: opts.id, animation: opts.animation}).set(opts).render();
                    this.res.appendChild(spanEl);
                });

                // 3️⃣ Append remaining text after the last span
                if (cursor < fullText.length) {
                    const remainingText = fullText.substring(cursor);
                    this.res.appendChild(new this.constructor(remainingText).setup({type: "span"}).set({}).render());
                }
            }
        });
    }

} else {
    // fallback to full text
    let t = new this.constructor(this.prevText).set({}).render();
    if (this.prevText && this.prevText.length > 0 && qban) {
        this.res.appendChild(t);
    }
}


  

  
	
  if (operations.includes("animation")) {	
//	alert(this.openTag)
	

if (this.options.animation && !this.hasAnimated && !this.options.animation.op.fireAt){

this.hasAnimated = true;
let ass = this.options.animation.op;

 this._on(window, /*this.openTag*/"sidebar:open", () => {
		
    this.res.animate(ass.keyframesOpen, ass.openOptions);
  });

   this._on(window, /*this.closeTag*/ "sidebar:closed", () => {
	
    this.res.animate(ass.keyframesClose, ass.closeOptions);
  });


	this.res.animate(ass.keyframesClose, {
		duration: 0,
		fill: "forwards"
	   });


	   if (this.openTag && this.closeTag){
		
this._on(window, this.openTag, () => {
		this.res.animate(ass.keyframesOpen, ass.openOptions);
	});
// "sidebar:opened" "sidebar:closed"
	this._on(window, this.closeTag, () => {
		this.res.animate(ass.keyframesClose, ass.closeOptions);
	});
	   }
	

}

// 18:42:30 it works! 02/02/2025
// Thanks ChatGPT!
	  if (this.options.animation && this.options.animation.op.fireAt && this.options.animation.op.fireAt.endsWith("px")) {

		  let ass = this.options.animation.op;

		  this.res.animate(ass.keyframesClose, {
			  duration: 0,
			  fill: "forwards"
		  });

		  const scrollHandler = () => {
			  if (window.scrollY > parseFloat(ass.fireAt)) {
				  this.res.animate(ass.keyframesOpen, ass.openOptions);
				  window.removeEventListener("scroll", scrollHandler);
			  }
		  };

		  this._on(window, "scroll", scrollHandler);

	  } 

	  if (this.options.animation && this.options.animation.op.fireAt === "inview") {
  let ass = this.options.animation.op;
  this.res.animate(ass.keyframesClose, { duration: 0, fill: "forwards" });

  let hasOpened = false;

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasOpened) {
        hasOpened = true;
        this.res.animate(ass.keyframesOpen, ass.openOptions);
        observer.disconnect();
      }
    });
  });

  observer.observe(this.res);
  this._track(() => observer.disconnect());
}


	
		
	}

	}
  
	// Add an event listener to check queries on window resize
	
	if (!this.options.animation /*&& this.getType() !== "LayoutWrapperElement"*/){
	
	this._on(window, 'resize', () => checkQueries());
	}
	
	checkQueries();
  }
  
  //--------- END OF INDEPENDENT
  
  reactOnTransform = (obj) => {
//alert("///"); // UL DOES NOT REACH THIS DESPITE SAME SYNTAX

//console.log(obj.op.transform); // I need obj.op.transform
// 


	if (obj.transform || (obj.op /*&& obj.op.transform*/)){
		


		let transform = obj.op;//transform; 

		if (!obj.transform ){ // 21:48:05 Nice!!! 30/03/25
			transform = obj.op;
		}

		if (!transform.duration){
			transform.duration = "3s-ease-in-out";
		}


	
		//  {static: true, keep: true, values: Array(4), duration: '3s-ease-in-out'
		// SIMPLE
		
		// COMPLEX
		// {static: true, keep: true, values: Array(4), duration: '3s-ease-in-out'}
		
		
		this.setDefault = (value, defaultValue = "0px") => {
			return value.length === 0 ? defaultValue + " " : value;
		}

		const convertRotateString = (input)  => {
			const match = input.match(/rotate\(([^)]+)\)/);
			if (!match) return input; // Return unchanged if no match found
		
			const values = match[1].split(',').map(v => v.trim());
		
			if (values.length === 1) {
				return `rotate(${values[0]})`;
			} else if (values.length === 2) {
				return `rotateX(${values[0]}) rotateY(${values[1]})`;
			} else if (values.length === 3) {
				return `rotateX(${values[0]}) rotateY(${values[1]}) rotate(${values[2]})`;
			}
		
			return input; // Return unchanged if more than 3 values
		}
		
	
	const perform = () => {
		
	let translateX = '';
	let translateY = '';
	let translateZ = '';
	let scale = '';
	let skew = '';
	let rotate = '';
	let perspective = '';
	let matrix = '';
	let opacity = '';

	// There is still nested transform object

	// Check if the transform values array is empty
	if (transform.values.length === 0) { 
		return; // If the array is empty, exit the function
	}


	// Loop through the transform values and extract the needed ones
	transform.values.forEach(value => {
		if (value.startsWith('tx:')) {
			translateX = value.replace('tx:', ''); // Extract -20px from ty:-20px
		} if (value.startsWith('ty:')) {
			translateY = value.replace('ty:', ''); // Extract -20px from ty:-20px
		} if (value.startsWith('tz:')) {
			translateZ = value.replace('tz:', ''); // Extract -20px from ty:-20px
		} else if (value.startsWith('scale(')) {
			scale = value; // Extract scale(3) or any other scale
		} else if (value.startsWith("skew(")) {
			skew = value;
		}  else if (value.startsWith("rotate(")) {
			rotate = convertRotateString(value);
		} else if (value.startsWith("perspective(")) {
			perspective = value;
		} else if (value.startsWith("matrix(")) {
			matrix = value;
		} else if (value.startsWith("opacity:")) {
			opacity = value.replace('opacity:', '');
			//alert(opacity);
		}
	});

	

	translateX = this.setDefault(translateX);
	translateY = this.setDefault(translateY);
	translateZ = this.setDefault(translateZ);

	// Apply the transform to the element, only if translateY or scale is present
	let transformValue = '';
	// PROBLEM HERE
	// transformValue += `translate(30px, 0px, 0px)`; // CSS translate has only two vals  (need trans3D for 3)
	
	
	if (translateY != "0px" && translateX != "0px" && translateZ != "0px") {
		transformValue += `translate3d(${translateX}, ${translateY}, ${translateZ})`;
	} else if (translateY != "0px" || translateX != "0px") {
		transformValue += `translate(${translateX}, ${translateY})`
	};


	if (scale) transformValue += ` ${scale}`;
	if (rotate) transformValue += ` ${rotate}`;
	if (skew) transformValue += ` ${skew}`;
	if (perspective) transformValue += ` ${perspective}`;
	if (matrix) transformValue += ` ${matrix}`;

	if (transformValue) {
		// alert("/") 

		if (obj.op.duration){ // transform 3s in and out takes 8 secs instead of 6....
			let newStr = obj.op.duration.replace(/^(\d+)(s)-/, (_, n, s) => n / 2 + s + " "); 
//alert(newStr);

			//newStr = "6s";
			let trans = `transform ${newStr}, opacity  ${newStr}`; // Reset transition
			this.res.style.transition = trans;
		
		} else {
			
			this.res.style.transition = "transform 3s ease-in-out, opacity 3s ease-in-out"; // Reset transition
		}

		if (obj.op.static){
			this.res.style.transition = "";
		}

		// 17:37:15 a comma was missing
		(this.blastTarget || this.res).style.transform = transformValue;
		this.res.style.opacity = opacity;
	} else {
		console.warn("[nodality] transform produced no geometric value - check `values`")
	}
	}


	if (transform.on){
		this.res.addEventListener(transform.on, () => {
			if (transform.delay) {
				setTimeout(() => {
					perform();
				}, transform.delay);

			} else {
				perform()
			}
		});
		
	} else {
		
		this._on(window, "load", () => {
			if (transform.delay) {

				setTimeout(() => {
					perform();
				}, transform.delay);
			} else {
				perform();
			}
		})
		
		
	}


	const reset = () => {
		let resetTransformValue = '';

		transform.values.forEach(value => {
			if (value.startsWith('tx:')) {
				resetTransformValue += "translateX(0) ";
			} else if (value.startsWith('ty:')) {
				resetTransformValue += "translateY(0) ";
			} else if (value.startsWith('tz:')) {
				resetTransformValue += "translateZ(0) ";
			} else if (value.startsWith('scale(')) {
				resetTransformValue += "scale(1) ";
			} else if (value.startsWith('skew(')) {
				resetTransformValue += "skew(0, 0) "; // Assuming 2D skew reset
			} else if (value.startsWith('rotate(')) {
				resetTransformValue += "rotate(0) ";
			} else if (value.startsWith('perspective(')) {
				resetTransformValue += "perspective(0) "; // Assuming 0 for perspective
			} else if (value.startsWith('matrix(')) {
				resetTransformValue += "matrix(1, 0, 0, 1, 0, 0) "; // Reset to identity matrix
			}

			this.res.style.opacity = "1";


		});
	
		// Apply reset transform if any values were provided
		if (resetTransformValue) {
			this.res.style.transform = resetTransformValue.trim(); // Remove trailing space
		}
	}


if (transform.on){

	this.res.addEventListener("mouseout", () => {
		if (!transform.keep){
			reset();
		}
		
	});
} else {
	let duration = parseFloat(transform.duration) * 1000;
	let resetAfter = transform.closeAfter ? transform.closeAfter : 0;

	setTimeout(() => {
		if (!transform.keep) {
			reset();
		}
	}, duration / 2 + resetAfter); // 15:16:26 Nice!!!
}

	if (transform.hardCSS){
		// alert("PI")
		this.res.style.transform = transform.hardCSS;
	}
	
	} else {
		console.warn("[nodality] reactOnTransform: unrecognised transform descriptor - ignored");
	}

	}


maxWidth(w){
    this.res.style.maxWidth = w;
    return this;
}

removeQuotesFromFirstWord(jsonString) {
	const modifiedJSON = jsonString.replace(keyPattern(), "$1:");
	return modifiedJSON;
  }
  


    
} // 2600-1870

export { Animator };
