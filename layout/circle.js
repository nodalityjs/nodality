/*!
 * nodality v1.0.0-beta.87
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */


  import { Animator } from "../../layout/animator.js";

class Circle extends Animator {
  constructor(obj = {}) {
    super();
    this.res = null;
    this.options = {};
    this.code = [];
    this.elCSS = [];
    this.html = [];
    this.react = [];
    this.setup(obj);
    this.code.push(`new Circle(${JSON.stringify(obj)})`);
  }


   toCode(){
   const codeObj = this.options || {};
  // stringify with indentation
  let str = JSON.stringify(codeObj, null, 2);
  // remove quotes around keys
  str = str.replace(/"([^"]+)":/g, '$1:');
  return `new Circle().set(${str})`;
  }
  

  // --- Layout helpers (kept similar to Text) ---
  flexOne() {
    this.res.style.flex = "1";
    return this;
  }

  setGridWithoutCode() {
    this.res.style.border = "1px solid white";
    return this;
  }

  setArea(area) {
    this.res.style.gridArea = area;
    return this;
  }

  rowCol(row, col) {
    this.res.style.gridRow = row;
    this.res.style.gridColumn = col;
    return this;
  }

  setGridRow(row) {
    this.res.style.gridRow = row;
    return this;
  }

  setGridCol(col) {
    this.res.style.gridColumn = col;
    return this;
  }

  // --- Serialization ---
  toCode() {
    if (this.excludeFromCodeTrue) return [""];

    const cleanedObj = Object.fromEntries(
      Object.entries(this.options || {}).filter(([, v]) => v !== null)
    );

    const objString = JSON.stringify(cleanedObj, null, 4).replace(/"([^\"]+)":/g, "$1:");
    return [`new Circle(${objString}).set(${objString})`];
  }

  toElCSS() {
    this.elCSS = this.elCSS.map((el) => "    " + el);
    this.preffersId
      ? this.elCSS.unshift(this.res.id + " { \n")
      : this.elCSS.unshift("." + this.class + " { \n");
    this.elCSS.push(" } \n \n");
    return this.elCSS;
  }

  toHTML() {
    return this.res;
  }

  getType() {
    return "LayoutWrapperElement"; // Circles are drawn with a DIV
  }

  // --- Circle-specific API ---
  diameter(px) {
    this.res.style.width = typeof px === "number" ? px + "px" : px;
    this.res.style.height = typeof px === "number" ? px + "px" : px;
    this.res.style.borderRadius = "50%";
    return this;
  }

  size(w, h = w) {
    this.res.style.width = typeof w === "number" ? w + "px" : w;
    this.res.style.height = typeof h === "number" ? h + "px" : h;
    this.res.style.borderRadius = "50%";
    return this;
  }

  center() {
    this.res.style.marginLeft = "auto";
    this.res.style.marginRight = "auto";
    return this;
  }

  // Visual style shorthands (parallel to Text, adapted for DIV)
  color(color) {
    // Use backgroundColor as the fill color for the circle
    this.res.style.backgroundColor = color;
    return this;
  }

  border(spec) {
    this.res.style.border = typeof spec === "string" ? spec : `${spec?.width || 1}px solid ${spec?.color || "black"}`;
    return this;
  }

  radius(r) {
    this.res.style.borderRadius = typeof r === "number" ? r + "px" : r;
    return this;
  }

  // --- Responsive feature options (compatible with chainReact usage) ---
  gradientOptions(optsa) {
    if (!optsa || optsa.length === 0) return this;
    const opts = optsa.filter((el) => el.op.name === "gradient")[0];
    if (!opts) return this;
    const options = opts.op;
    const breakpoint = opts.point;

    const apply = () => {
      const matches = window.matchMedia(`(min-width: ${opts.range[0]}) and (max-width: ${opts.range[1]})`).matches;
      if (matches) {
        this.res.style.background = options.gradient; // linear-gradient(...)
      }
    };

    if (breakpoint) {
      apply();
      window.addEventListener("resize", apply);
    }
    return this;
  }

  strokeOptions(optsa) {
    if (!optsa || optsa.length === 0) return this;
    const opts = optsa.filter((el) => el.op.name === "blast")[0];
    if (!opts) return this;
    const options = opts.op;
    const breakpoint = opts.point;

    const apply = () => {
      const matches = window.matchMedia(`(min-width: ${opts.range[0]}) and (max-width: ${opts.range[1]})`).matches;
      if (matches || !breakpoint) {
        const w = options.width ? options.width : "1px";
        const c = options.color ? options.color : "orange";
        this.res.style.border = `${w} solid ${c}`;
      }
    };

    apply();
    if (breakpoint) window.addEventListener("resize", apply);
    return this;
  }

  // --- Setup & main setter ---
  setup(obj = {}) {
    const el = document.createElement(obj.type || "div");
    if (obj.id) el.setAttribute("id", obj.id);
    this.res = el;
    this.res.style.padding = 0;
    this.res.style.margin = 0;
    this.res.style.display = obj.inline ? "inline-block" : "block";
    this.res.style.borderRadius = "50%"; // default to circle
    // default minimal size so it is visible
    if (!this.res.style.width) this.res.style.width = obj.width || "40px";
    if (!this.res.style.height) this.res.style.height = obj.height || "40px";
    return this;
  }

  excludeFromCode() {
    this.excludeFromCodeTrue = true;
    return this;
  }

  setClass(name) {
    this.res.setAttribute("class", name);
    return this;
  }

  setRandom() {
    let result = "CIRCLE-";
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 32; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    result += new Date().getTime();
    this.res.setAttribute("class", result);
    return this;
  }

  onTap(e) {
    this.res.addEventListener("click", e);
    return this;
  }

  // Main configuration entrypoint (parallel to Text.set)
  set(obj = {}) {
    this.options = obj;

    // Positioning
    obj.top && (this.res.style.top = obj.top);
    obj.left && (this.res.style.left = obj.left);
    if (obj.left || obj.top) this.res.style.position = "absolute";

    // Sizing
    if (obj.diameter) this.diameter(obj.diameter);
    obj.size && this.size(obj.size.w || obj.size, obj.size.h || obj.size);
    obj.width && (this.res.style.width = obj.width);
    obj.height && (this.res.style.height = obj.height);
    obj.radius && this.radius(obj.radius); // overrides 50% if desired

    // Identity / grouping
    obj.preffersId && (this.preffersId = obj.preffersId);
    super.setPref?.(obj.preffersId);
    obj.id && this.res.setAttribute("id", obj.id);
    super.setID?.(obj.id);
    obj.class && this.setClass(obj.class);
    super.setClass?.(obj.class);

    // Layering
    obj.index && super.setIndex?.(obj.index);
    obj.index && (this.index = obj.index);
    obj.zIndex && (this.res.style.zIndex = obj.zIndex);

    // Box model
    obj.pad && this.padding(obj.pad);
    obj.respad && this.respad?.(obj.respad);
    obj.resmar && this.resmar?.(obj.resmar);
    obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
    obj.arrpad && this.arrayPadding(obj.arrpad.sides, obj.arrpad.value);
    obj.mar && this.mar(obj.mar);
    obj.margin && this.margin(obj.margin);

    // Visual
    obj.background && (this.res.style.background = obj.background);
    obj.color && this.color(obj.color);
    obj.border && this.border(obj.border);
    obj.shadow && (this.res.style.boxShadow = obj.shadow);
    obj.cursor && (this.res.style.cursor = obj.cursor === true ? "pointer" : obj.cursor);

    // Grid helpers
    obj.area && this.setArea(obj.area);

    // Transforms / filters / animation hooks
    obj.filter && (this.res.style.filter = obj.filter);
    obj.transform && this.reactOnTransform?.(obj.transform);
    obj.animationCSS && (this.res.style.animation = obj.animationCSS);

    // Keep chainReact-compatible: collect ops with ranges
    let arr = [];
    if (
      obj.stroke ||
      obj.gradient ||
      obj.backgroundOp ||
      obj.layout ||
      obj.marginOp ||
      obj.shadow ||
      obj.animation ||
      obj.filtera ||
      obj.transform
    ) {
      if (obj.gradient) this.globalGradient = obj.gradient.op.gradient;
      if (obj.stroke) super.setAny?.({ globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}` });

      let ft = [
        obj.stroke,
        obj.gradient,
        obj.animation,
        obj.backgroundOp,
        obj.layout,
        obj.marginOp,
        obj.shadow,
        obj.animation,
        obj.filtera,
        obj.transform,
      ].filter((el) => el != undefined);

      for (let i = 0; i < ft.length; i++) {
        arr.push({ range: ft[i].range, log: ft[i].op.name, target: ft[i].target, op: ft[i].op });
      }

      let keep = [];
      if (obj.border) keep.push("border");
      if (obj.background) keep.push("background");
      if (obj.mar || obj.margin) keep.push("margin");
      if (obj.animation) keep.push("animation");

      this.chainReact(arr, this.options.id, keep);
    }

    return this;
  }

  // Box utilities (mirroring Text API names where sensible)
  padding(L, T, R, B) {
    if (L || T || R || B) {
      this.res.style.paddingLeft = L;
      this.res.style.paddingTop = T;
      this.res.style.paddingRight = R;
      this.res.style.paddingBottom = B;
    } else if (L) {
      this.res.style.padding = L;
    }
    return this;
  }

  arrayPadding(arr, value) {
    if (arr.includes("left")) this.res.style.paddingLeft = value;
    if (arr.includes("right")) this.res.style.paddingRight = value;
    if (arr.includes("top")) this.res.style.paddingTop = value;
    if (arr.includes("bottom")) this.res.style.paddingBottom = value;
    if (!value) this.res.style.paddingBottom = arr;
    return this;
  }

  mar(val) {
    this.res.style.margin = val;
    return this;
  }

  margin(directionOrVal, value) {
    if (value === undefined) {
      this.res.style.margin = directionOrVal;
    } else {
      const d = directionOrVal;
      if (d === "top") this.res.style.marginTop = value;
      else if (d === "bottom") this.res.style.marginBottom = value;
      else if (d === "left") this.res.style.marginLeft = value;
      else if (d === "right") this.res.style.marginRight = value;
    }
    return this;
  }

  arrayMargin(arr, value) {
    if (!value) {
      this.res.style.marginLeft = `${arr[0]}px`;
      this.res.style.marginTop = `${arr[1]}px`;
      this.res.style.marginRight = `${arr[2]}px`;
      this.res.style.marginBottom = `${arr[3]}px`;
      return this;
    }
    if (arr.includes("left")) this.res.style.marginLeft = value;
    if (arr.includes("right")) this.res.style.marginRight = value;
    if (arr.includes("top")) this.res.style.marginTop = value;
    if (arr.includes("bottom")) this.res.style.marginBottom = value;
    return this;
  }

  frame(obj) {
    if (obj.width) this.res.style.width = obj.width;
    if (obj.height) this.res.style.height = obj.height;
    this.res.style.borderRadius = "50%";
    return this;
  }

  hide() {
    this.res.style.visibility = "hidden";
    return this;
  }

  width(w, shouldCenter) {
    this.res.style.width = w;
    if (shouldCenter) {
      this.res.style.marginLeft = "auto";
      this.res.style.marginRight = "auto";
    }
    this.res.style.borderRadius = "50%";
    return this;
  }

  render(div) {
    if (div) {
      if (this.options && this.options.id) this.res.setAttribute("id", this.options.id);
      document.querySelector(div).appendChild(this.res);
    } else {
      return this.res;
    }
  }
}

export {Circle};