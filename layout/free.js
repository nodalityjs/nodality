import {Animator} from "./animator.js";

class Free extends Animator {
    constructor(){
        super();
        this.res = document.createElement("div");
        this.res.style.display = "grid";
        this.attributes = {};
    }

    set(obj){
        this.options = obj;
        this.attributes = obj;
        this.templateCols = obj.templateCols;
       // alert(this.templateCols);

        if (obj.templateCols) { // condition wrong
            this.res.style.gridTemplateColumns = `repeat(${obj.templateCols.cols}, 1fr)`;
            this.res.style.gridTemplateRows = `repeat(${obj.templateCols.cols}, 1fr)`;
        }

 
        this.res.style.height = obj.height ? obj.height : "600px";

        obj.positions && (this.storedPositions = obj.positions); //this.generateGridPositions(obj.position);

        return this;
    }


// move this function into free class
 generateGridPositions(attractions, rows = 30, cols = 50) {
    const container = document.createElement("div");
    container.classList.add("container");
    container.style.display = "grid";
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; 
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    container.style.width = "100%";
    container.style.height = "100vh";

    let defaultPositions = attractions.map((_, index) => ({
        row: Math.floor(rows / 2) + index, // Slightly offset to avoid exact overlap
        col: Math.floor(cols / 2) + index
    }));

    // Function to compute resulting force vector for a specific element
    function computeForceVector(targetIndex) {
        let forceX = 0;
        let forceY = 0;

        attractions.forEach((attr, index) => {
            const { weight, direction } = attr;
            const targetPosition = defaultPositions[targetIndex];
            const attractionPosition = defaultPositions[index];

            // Calculate the distance between the target and the attraction
            const dx = targetPosition.col - attractionPosition.col;
            const dy = targetPosition.row - attractionPosition.row;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Add a softening factor: make the force fall off gradually with distance
            const scalingFactor = 1 / (distance + 1); // Smaller influence for greater distance

            // Scale the force by the weight and the softening factor
            const scaledWeight = weight * scalingFactor;

            // Apply the force
            switch (direction) {
                case "L":
                    forceX -= scaledWeight;
                    break;
                case "R":
                    forceX += scaledWeight;
                    break;
                case "U":
                    forceY -= scaledWeight;
                    break;
                case "B":
                    forceY += scaledWeight;
                    break;
            }
        });

        return { forceX, forceY };
    }

    attractions.forEach((attr, index) => {
        let { row, col } = defaultPositions[index];

        // Compute the force vector for the current element
        const { forceX, forceY } = computeForceVector(index);

        // Apply the force to determine new position (apply moderate force)
        col = Math.max(1, Math.min(cols, col + Math.round(forceX)));
        row = Math.max(1, Math.min(rows, row + Math.round(forceY)));
 
console.log(this.items.map(el => el.id));
console.log(attr.attract.slice(1));
      //  alert("#" + attr.attract.slice(1));
        const element = this.items.filter(el => el.id === attr.attract.slice(1))[0].render(); //Array(this.res.children).filter(el => el.getAttribute("id") === attr.attract.slice(1)); //this.res.querySelector("#" + attr.attract.slice(1));//document.createElement("div");
        console.log(element);
   
        //  element.id = attr.attract.slice(1);
        element.style.gridRowStart = row;
        element.style.gridRowEnd = row + 3; // Example height of 3 grid cells
        element.style.gridColumnStart = col;
        element.style.gridColumnEnd = col + 5; // Example width of 5 grid cells

        element.style.border = `3px solid #${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;//[]
       
       /*if (element.toString() === "[HTMLParagaphElement]"){
        element.style.width = "fit-content";
       }*/

        // Optional: Add some content or styles for better visibility
       // element.textContent = `${attr.attract.slice(1)}`
        
        //\n(${forceX.toFixed(2)}, ${forceY.toFixed(2)})`;
        element.style.display = "flex";
        element.style.alignItems = "center";
        element.style.justifyContent = "center";
        element.style.fontWeight = "bold";
        element.style.color = "white";
       // alert(element)
        this.res.appendChild(element);

       // this.res.style.border = "3px solid #1abc9c";
    });

   // document.body.appendChild(container);
   console.log("ARAO");
   console.log(this.res.children.length);
   return this;
}


    add(items){
      this.items = items;
        
        // Render each component in the grid container
        for (const component of items) {
            this.res.appendChild(component.render());
           // alert("PP");
       //    console.log("ORAA");
       //    console.log(this.res.children.length);
        }

           //   alert("PP");
     //  alert(this.res);

        if (this.storedPositions){
            this.generateGridPositions(this.storedPositions);
            
        }

        console.log("MORAA");
            console.log(this.res.children.length);
       
        return this;
    }

   /* toCode(){
        let codeStr = `new Free()`;

        // 16:01:09 09/11/24 What????
        // Convert attributes to .set({...}) format if there are any attributes
        if (Object.keys(this.attributes).length > 0) {
            codeStr += `.set(${JSON.stringify(this.attributes, null, 2).replace(/"([^"]+)":/g, '$1:')})`;

          //  codeStr += `.set(${JSON.stringify(this.attributes, null, 2)})`;
        } else {
            codeStr += `.set({})`;
        }
    
        codeStr += `.add([\n`;
    
        // Generate the code for each item and join with commas only between items
        codeStr += this.items
            .map(item => item.toCode().join("").trim()) // Trim any line breaks or whitespace around the item code
            .join(",\n"); // Insert commas only between items
    
        codeStr += `\n])`;
    

        return codeStr;
    }*/

        toCode() {
            if (this.excludeFromCodeTrue){
                // this.code = ["new Text('').set({})"];
                return [""];
            }
    
            const objString = JSON
                .stringify(this.options, null, 4)
                .replace(/"([^"]+)":/g, '$1:');
    

                var codeStr = "";
                codeStr += `.add([\n`;
    
                // Generate the code for each item and join with commas only between items
                codeStr += this.items
                    .map(item => item.toCode().join("").trim()) // Trim any line breaks or whitespace around the item code
                    .join(",\n"); // Insert commas only between items
            
                codeStr += `\n])`;

                
            return [`new Free().set(${objString})${codeStr}`];
        }

    render(div){

        // ARE THERE CHILDREN
      console.log("CHILDREN IN RENDER");
      console.log(this.res.children.length);


        if (div){
            document.querySelector(div).appendChild(this.res);
            return;
        }

        

     //   alert("PP");
     //  alert(this.res);
        return this.res;
    }
}
export { Free };
