
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
    console.log("CODEA");
    console.log(this.elements);
    console.log(this.elements.length );
  
      elements.forEach((element) => {
        if (element && typeof element.render === "function") {
          //this.elements.push(element);
          this.formElement.appendChild(element.render());
        } else {
          throw new Error("Each element in the array must have a render method that returns an HTML DOM element.");
        }
      });

      console.log(this.elements);

      return this;
    }

  toCode(){
   
    let mapped = this.elements.map(e => e.toCode());
   

    let setCode = Object.entries(this.obj)
    .map(([key, value]) => {
      let formattedValue = typeof value === "string" ? `"${value}"` : value;
      return `${key}: ${formattedValue}`;
    })
    .join(", ");

    console.log("FORM DQ");
    console.log(mapped);
    return [`new Form().set({${setCode}}).add([ \n ${mapped.join(", \n")}])`];
  }

  set(obj) {
    this.obj = obj;
    obj.action && this.setAction(obj.action);
    obj.method && this.setMethod(obj.method);
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