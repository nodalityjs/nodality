import {Animator} from "./animator.js";

class Table extends Animator {
  constructor() {
    super();
    this.res = document.createElement("table");
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
    this.res.style.fontFamily = obj.font;
    return this;
  }

  set(obj) {
    obj.cellPadding && this.cellPadding(obj.cellPadding);
    obj.cellAlign && this.cellAlign(obj.cellAlign);
    obj.style && this.style(obj.style);
    obj.headStyle && this.headStyle(obj.headStyle);
    obj.border && this.border(obj.border);
    obj.center && this.center(obj.center);
    obj.borderRadius && this.borderRadius(obj.borderRadius);
    this.obj = obj;
    return this;
  }

  toCode() {
    let code = `new Table().add(${JSON.stringify(this.data)}).set(${JSON.stringify(this.obj)})`;
    code = code.replace(/"(\w+)":/g, '$1:');
    code = code.replace(/,/g, ',\n');
    return [code];
  }

  center() {
    this.res.style.marginLeft = "auto";
    this.res.style.marginRight = "auto";
    return this;
  }

  borderRadius(num) {
    this.res.style.borderCollapse = "separate";
    this.res.style.borderSpacing = 0;
    this.res.style.overflow = "hidden";

    const table = this.res;
    const cols = Object.keys(this.datas[0]).length;
    const rows = this.datas.length + 1;

    for (let i = 0; i < cols; i++) {
      table.rows[0].cells[i].style.borderTop = `${num * 2}px solid black`;
      table.rows[rows - 1].cells[i].style.borderBottom = `${num * 2}px solid black`;
    }

    for (let i = 0; i < rows; i++) {
      table.rows[i].cells[0].style.borderLeft = `${num * 2}px solid black`;
      table.rows[i].cells[cols - 1].style.borderRight = `${num * 2}px solid black`;
    }

    table.rows[0].cells[0].style.borderTopLeftRadius = "10px";
    table.rows[0].cells[cols - 1].style.borderTopRightRadius = "10px";
    table.rows[rows - 1].cells[0].style.borderBottomLeftRadius = "10px";
    table.rows[rows - 1].cells[cols - 1].style.borderBottomRightRadius = "10px";

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

  border(borderStyle) {
    this.res.style.borderCollapse = "collapse";
    for (let row of this.res.rows) {
      row.style.border = borderStyle;
      for (let cell of row.cells) {
        cell.style.border = borderStyle;
      }
    }
    return this;
  }

  generateTableHead(table, data) {
    const thead = table.createTHead();
    const row = thead.insertRow();
    for (let key of data) {
      const th = document.createElement("th");
      const text = document.createTextNode(key);
      th.appendChild(text);
      row.appendChild(th);
    }
  }

  generateTable(table, data) {
    for (let element of data) {
      const row = table.insertRow();
      for (let key in element) {
        const cell = row.insertCell();
        const text = document.createTextNode(element[key]);
        cell.appendChild(text);
      }
    }
  }

  render(div) {
    if (div) {
      const wrapper = document.createElement("div");
      wrapper.style.overflowX = "auto";
      wrapper.appendChild(this.res);
      document.querySelector(div).appendChild(wrapper);
    } else {
      const wrapper = document.createElement("div");
      wrapper.style.overflowX = "auto";
      wrapper.appendChild(this.res);
      return wrapper;
    }
  }
}



export { Table };
