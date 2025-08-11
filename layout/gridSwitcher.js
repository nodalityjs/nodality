class Simple {
    constructor() {
      
      this.gridContainer = document.createElement("div");
      this.gridContainer.classList.add("grid-container");
      this.gridContainer.style.display = "grid";
    //  this.gridContainer.style.gridAutoRows = "1fr"; EVIL LINE
    }

    set(obj){
      obj.gap &&  (this.gridContainer.style.gap = obj.gap);
      obj.height && (this.gridContainer.style.height = obj.height);
      obj.width && (this.gridContainer.style.width = obj.width);
      return this;
    }

    /*
    [
                   {
                     at: "default",
                     template: [
                     "abbbbb",
                     "abbbbb",
                     "abbbbb",
                     "cccccc",
                     "cccccc",
                     "dddddd",
                     "eeeeee",
                     "eeeeee"
                   ] 
                   },
    */
    react(arr){
      const reacta = () => {
        console.log(arr.length);
for (var i = 0; i < arr.length - 1; i++){
 // alert(parseInt(arr[i].at))
 console.warn(window.innerWidth);
 //console.warn("BETWEEN" + parseInt(arr[i].at) + " - " + parseInt(arr[i + 1].at) );

 let from = parseInt(arr[i].at);
 let to = parseInt(arr[i + 1].at);


  if ( window.innerWidth > from && window.innerWidth < to ){
//alert("O")
console.log("FROM    " + from + "    TO  " + to);
    let obj = arr[i].template;

     let withSpaceObj = obj.map(str => str.split('').join(' '));
     const outputString = withSpaceObj.map(row => `"${row}"`).join(" ");
     this.gridContainer.style.gridTemplateAreas = outputString;
 
     this.gridContainer.style.border = `3px solid ${arr[i].color}`;
 
    } else if (window.innerWidth > to) {
      this.gridContainer.style.border = `3px solid ${arr[arr.length - 1].color}`;
      console.log("BIGGER THAN"  +  " "  + to);
      //alert("P")
      // This always fires
      let obj = arr[arr.length - 1].template;

      let withSpaceObj = obj.map(str => str.split('').join(' '));
      const outputString = withSpaceObj.map(row => `"${row}"`).join(" ");
      this.gridContainer.style.gridTemplateAreas = outputString;
  
    }


}
//return this;
      }
      reacta();
     window.addEventListener("resize", reacta);
     return this;
    }
  
     add(items){
      console.log(items);
  
   //   let withSpaceObj = obj.map(str => str.split('').join(' '));
   //   const outputString = withSpaceObj.map(row => `"${row}"`).join(" ");
   //   this.gridContainer.style.gridTemplateAreas = outputString;//'"a a a" "b b b" "c d d" "c d d"';
     // Function to generate alphabetic sequences
  const generateAlphabeticSequence = (count) => {
    const chars = [];
    for (let i = 0; i < count; i++) {
      let str = '';
      let num = i;
      do {
        str = String.fromCharCode(65 + (num % 26)) + str; // Generate character
        num = Math.floor(num / 26) - 1;
      } while (num >= 0);
      chars.push(str);
    }
    return chars;
  };

  // Generate 'els' array dynamically
  let els = generateAlphabeticSequence(items.length); // ['A', 'B', ..., 'Z', 'AA', 'AB', ...]

  for (let i = 0; i < items.length; i++) {
    let e = items[i].render();
    e.style.border = "1px solid gray";
    e.style.gridArea = els[i].toLowerCase(); // e.g., 'a', 'b', 'aa', 'ab', ...

    const gridItem = document.createElement("div");
    gridItem.textContent = items[i].text;
    gridItem.style.gridArea = els[i].toLowerCase();
    this.gridContainer.appendChild(e);
  }
  
    return this;
     }


     render(el) {
      el && document.querySelector(el).appendChild(this.gridContainer);
      return this.gridContainer;
    }

      toCode(){
      return `new Simple().set({}).react([])`;
    }
  }
  
  // Usage example:
  //const simpleGrid = new Simple();
  //document.body.appendChild(simpleGrid.render());
  
  
  class GridSwitcher {
    constructor(){
     this.el = document.createElement("div");
     this.gridWrap = document.createElement("div");
    }
  
    DOMAdd(dom){
      this.domStr = dom;
      this.domEl = document.querySelector(dom);
      return this;
    }
  
    items(arr){
      this.items = arr;
      return this;
    }
  
    dynamicItems(arr){
      this.dynamicItems = arr;
      return this;
    }
    switch(breakpoints){
      const innerSwitch = () => {
          for (let i = 0; i < breakpoints.length; i++){
              const val = breakpoints[i];
              let mq = window.matchMedia(`(max-width: ${val.at})`).matches;
              if ((mq || val.at == "default") && mq !== this.lastMq){
                  const update = new Simple().set(val.template, this.dynamicItems).render();
                  this.el = update;
                  this.el.style.border  = "1px solid black";
                  this.render(this.domStr);
                  this.lastMq = mq;
              }
          }
      }
      innerSwitch();
      window.addEventListener("resize", innerSwitch);
      return this;
  }
  
    render(div){
      this.gridWrap.innerHTML = "";
      this.gridWrap.appendChild(this.el);

   // document.querySelector(div).removeChild(this.el);
  if (div){
    document.querySelector(div).appendChild(this.gridWrap);
  } 

  return this.gridWrap;

   // return this.el;
      // Just return this.el it normally
    }
  }
  
  export {Simple};
