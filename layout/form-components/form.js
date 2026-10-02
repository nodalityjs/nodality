/*!
 * nodality v1.3.15
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */


import {Animator} from "../animator.js";

class Form {
    constructor(action = "", method = "POST") {
      this.action = action;
      this.method = method;
      this.elements = [];
      this.formElement = document.createElement("form");
      this.formElement.action = this.action;
      this.formElement.method = this.method;
    }
  
    add(elements) {
    this.elements = elements;
  
      elements.forEach((element) => {
        if (element && typeof element.render === "function") {
          //this.elements.push(element);
          this.formElement.appendChild(element.render());
        } else {
          throw new Error("Each element in the array must have a render method that returns an HTML DOM element.");
        }
      });


      return this;
    }

  toCode(){
   
    let mapped = this.elements.map(e => e.toCode());
   

    let setCode = Object.entries(this.obj)
    .map(([key, value]) => {
      // JSON for strings: a title or action containing a quote produced
      // code that did not parse.
      let formattedValue = typeof value === "string" ? JSON.stringify(value) : value;
      return `${key}: ${formattedValue}`;
    })
    .join(", ");

    return [`new Form().set({${setCode}}).add([ \n ${mapped.join(", \n")}])`];
  }

  set(obj) {
    this.obj = obj;
    obj.action && this.setAction(obj.action);
    obj.method && this.setMethod(obj.method);
    // The id reaches the rendered <form>. Without it the element the
    // descriptor named could not be found again from outside — by a
    // test, by a script, or by the derived agent surface, which locates
    // a form by the id its descriptor declared.
    obj.id && (this.formElement.id = obj.id);
    // The title names the form: for assistive technology (a named form is a
    // landmark) and for the agent surface, which describes its submit tool
    // with the same sentence. It was read only by the agent surface, so the
    // schema reported it as ignored by the form.
    obj.title && this.formElement.setAttribute("aria-label", obj.title);
    return this;
  }

    setAction(action) {
      this.action = action;
      this.formElement.action = this.action;
    }
  
    setMethod(method) {
      this.method = method;
      this.formElement.method = this.method;
    }
  
    render(el) {
        if (el){
            document.querySelector(el).appendChild(this.formElement);
        }
      return this.formElement;
    }
  }

  export {Form};