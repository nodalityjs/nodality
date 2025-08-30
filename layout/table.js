/*!
 * nodality v1.0.12
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";

class Table extends Animator {
  constructor() {
    super();
    this.res = document.createElement("table");
    this.res.style.borderCollapse = "separate"; // needed for radius
    this.res.style.borderSpacing = "0";         // remove gaps
    this.res.style.overflow = "hidden";         // clip children
   
  }

  add(data) {
    this.data = data;
    this.datas = data;
    const datas = Object.keys(data[0]);
    this.generateTable(this.res, data);
    this.generateTableHead(this.res, datas);
    return this;
  }

  style(obj) {
    if (obj.font) this.res.style.fontFamily = obj.font;
    return this;
  }

  getType() {
    return "LayoutWrapperElement";
  }

  set(obj) {
    obj.cellPadding && this.cellPadding(obj.cellPadding);
    obj.cellAlign && this.cellAlign(obj.cellAlign);
    obj.style && this.style(obj.style);
    obj.headStyle && this.headStyle(obj.headStyle);
    obj.border && this.border(obj.border);
    obj.center && this.center(obj.center);
    obj.borderRadius && this.borderRadius(obj.borderRadius);

    // background + gradient
    if (obj.gradient) {
      this.res.style.background = obj.gradient.op.gradient;
      this.res.style.backgroundClip = "padding-box";
    }

    this.obj = obj;
    this.options = obj;
    this.callReact(obj); // 🔥 restored
    return this;
  }

  callReact(obj) {
    let arr = [];

    if (
      obj.stroke || obj.gradient || obj.span || obj.backgroundOp ||
      obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform
    ) {
      if (obj.gradient) {
        this.globalGradient = obj.gradient.op.gradient;
    
        if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}
    
      }

      if (obj.stroke) {
        super.setAny({ globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}` });
      }

      if (obj.span) {
        obj.span.prevText = this.text;
      }

      let ft = [
        obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp,
        obj.layout, obj.marginOp, obj.shadow, obj.animation, obj.filtera, obj.transform
      ];
      ft = ft.filter(el => el != undefined);

      for (let i = 0; i < ft.length; i++) {
        arr.push({
          range: ft[i].range,
          log: ft[i].op.name,
          target: ft[i].target,
          op: ft[i].op
        });
      }

      let keep = [];
      if (obj.borderObj) keep.push("border");
      if (obj.background) keep.push("background");
      if (obj.mar) keep.push("margin");
      if (obj.animation) keep.push("animation");
      if (obj.span) keep.push("span");

      keep.push("border");

      console.log("ARA IS ", arr);

      this.chainReact(arr, this.options.id, keep);

        //  this.res.style.border = "1px solid green";
    }
  }

  toCode() {
    let prettyData = JSON.stringify(this.data, null, 2);
    let prettyObj = JSON.stringify(this.obj, null, 2);

    prettyData = prettyData.replace(/"(\w+)"\s*:/g, '$1:');
    prettyObj  = prettyObj.replace(/"(\w+)"\s*:/g, '$1:');

    let code = `new Table()
      .add(${prettyData})
      .set(${prettyObj})`;

    return [code];
  }

  borderRadius(num) {
    this.res.style.borderRadius = `${num * 4}px`;
    this.res.style.overflow = "hidden"; // clip inside
    return this;
  }

  center() {
    this.res.style.marginLeft = "auto";
    this.res.style.marginRight = "auto";
    return this;
  }

  cellPadding(padding) {
    for (let row of this.res.rows) {
      for (let cell of row.cells) {
        cell.style.padding = padding;
      }
    }
    return this;
  }

  cellAlign(align) {
    for (let row of this.res.rows) {
      for (let cell of row.cells) {
        cell.style.textAlign = align;
      }
    }
    return this;
  }

  headStyle(style) {
    const row = this.res.rows[0];
    if (row) {
      row.style.color = style.color;
      if (style.background) {
        row.style.backgroundColor = style.background;
      }
    }
    return this;
  }
/*
  border(borderStyle) {
    this.res.style.border = borderStyle; // outer border
    for (let row of this.res.rows) {
      for (let cell of row.cells) {
        cell.style.border = "1px solid black"; // inner lines
      }
    }
    return this;
  }*/

    border(borderStyle) {
  // Ensure separate borders so radius works
  this.res.style.borderCollapse = "separate";
  this.res.style.borderSpacing = "0";
  this.res.style.border = borderStyle;
  this.res.style.borderRadius = "12px"; // default radius, can be set via .borderRadius()

  // Reset all cell borders
  for (let row of this.res.rows) {
    for (let cell of row.cells) {
      cell.style.border = "none";
    }
  }

  // Add horizontal borders between rows
  for (let r = 0; r < this.res.rows.length - 1; r++) {
    for (let cell of this.res.rows[r].cells) {
      cell.style.borderBottom = borderStyle;
    }
  }

  // Add vertical borders between columns
  const cols = this.res.rows[0]?.cells.length || 0;
  for (let row of this.res.rows) {
    for (let c = 0; c < cols - 1; c++) {
      row.cells[c].style.borderRight = borderStyle;
    }
  }

  return this;
}

  generateTableHead(table, data) {
    const thead = table.createTHead();
    const row = thead.insertRow();
    for (let key of data) {
      const th = document.createElement("th");
      th.textContent = key;
      row.appendChild(th);
    }
  }

  generateTable(table, data) {
    for (let element of data) {
      const row = table.insertRow();
      for (let key in element) {
        const cell = row.insertCell();
        cell.textContent = element[key];
      }
    }
  }

  render(div) {
    const wrapper = document.createElement("div");
    wrapper.style.overflowX = "auto";

    wrapper.appendChild(this.res);
    if (div) {
      document.querySelector(div).appendChild(wrapper);
    } else {
      return wrapper;
    }
  }
}

export { Table };
