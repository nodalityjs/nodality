import { Animator } from "./animator.js";

class Circle extends Animator {
  constructor() {
    super();
    this.res = null;
    this.options = {};
    this.code = [];
    this.elCSS = [];
    this.html = [];
    this.react = [];
    this.setup(); // just creates the element, no obj applied
  }

  // --- Setup ---
  setup() {
    const el = document.createElement("div");
    this.res = el;
    this.res.style.padding = 0;
    this.res.style.margin = 0;
    this.res.style.borderRadius = "50%"; // default circle
    return this;
  }

  // --- Serialization ---
  toCode() {
    if (this.excludeFromCodeTrue) return [""];

    const cleanedObj = Object.fromEntries(
      Object.entries(this.options || {}).filter(([, v]) => v != null)
    );

    const objString = JSON.stringify(cleanedObj, null, 4).replace(/"([^"]+)":/g, "$1:");
    return [`new Circle().set(${objString})`];
  }

  // --- Layout helpers ---
  flexOne() { this.res.style.flex = "1"; return this; }
  setGridWithoutCode() { this.res.style.border = "1px solid white"; return this; }
  setArea(area) { this.res.style.gridArea = area; return this; }
  rowCol(row, col) { this.res.style.gridRow = row; this.res.style.gridColumn = col; return this; }
  setGridRow(row) { this.res.style.gridRow = row; return this; }
  setGridCol(col) { this.res.style.gridColumn = col; return this; }

  // --- Circle-specific API ---
  diameter(px) { this.res.style.width = this.res.style.height = typeof px === "number" ? px + "px" : px; this.res.style.borderRadius = "50%"; return this; }
  size(w, h = w) { this.res.style.width = typeof w === "number" ? w + "px" : w; this.res.style.height = typeof h === "number" ? h + "px" : h; this.res.style.borderRadius = "50%"; return this; }
  center() { this.res.style.marginLeft = this.res.style.marginRight = "auto"; return this; }
  color(c) { this.res.style.backgroundColor = c; return this; }
  border(spec) { this.res.style.border = typeof spec === "string" ? spec : `${spec?.width || 1}px solid ${spec?.color || "black"}`; return this; }
  radius(r) { this.res.style.borderRadius = typeof r === "number" ? r + "px" : r; return this; }

  // --- Main configuration entrypoint ---
  set(obj = {}) {
    this.options = obj;

    // Positioning
    obj.top && (this.res.style.top = obj.top);
    obj.left && (this.res.style.left = obj.left);
    if (obj.top || obj.left) this.res.style.position = "absolute";

    // Sizing
    obj.diameter && this.diameter(obj.diameter);
    obj.size && this.size(obj.size.w || obj.size, obj.size.h || obj.size);
    obj.width && (this.res.style.width = obj.width);
    obj.height && (this.res.style.height = obj.height);
    obj.radius && this.radius(obj.radius);

    // Identity / grouping
    obj.id && this.res.setAttribute("id", obj.id);
    obj.class && this.res.setAttribute("class", obj.class);

    // Layering
    obj.zIndex && (this.res.style.zIndex = obj.zIndex);

    // Box model
    obj.pad && (this.res.style.padding = obj.pad);
    obj.mar && (this.res.style.margin = obj.mar);

    // Visual
    obj.background && (this.res.style.background = obj.background);
    obj.color && this.color(obj.color);
    obj.border && this.border(obj.border);
    obj.shadow && (this.res.style.boxShadow = obj.shadow);
    obj.cursor && (this.res.style.cursor = obj.cursor === true ? "pointer" : obj.cursor);




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

    if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}
        
    if (obj.stroke)
        super.setAny?.({
            globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`
        });

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
        arr.push({
            range: ft[i].range,
            log: ft[i].op.name,
            target: ft[i].target,
            op: ft[i].op
        });
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

  getType(){
    return "LayoutWrapperElement";
  }

  // --- Utilities ---
  excludeFromCode() { this.excludeFromCodeTrue = true; return this; }
  setClass(name) { this.res.setAttribute("class", name); return this; }
  onTap(fn) { this.res.addEventListener("click", fn); return this; }

  // --- Render ---
  render(selector) {
    if (selector) document.querySelector(selector)?.appendChild(this.res);
    return this.res;
  }
}

export { Circle };
