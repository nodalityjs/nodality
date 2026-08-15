/*!
 * nodality v1.1.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

import { toObjectSource } from "../lib/codegen.js";
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
 
      //  alert("#" + attr.attract.slice(1));
        const element = this.items.filter(el => el.id === attr.attract.slice(1))[0].render(); //Array(this.res.children).filter(el => el.getAttribute("id") === attr.attract.slice(1)); //this.res.querySelector("#" + attr.attract.slice(1));//document.createElement("div");
   
        //  element.id = attr.attract.slice(1);
        element.style.gridRowStart = row;
        element.style.gridColumnStart = col;

       

        // Optional: Add some content or styles for better visibility
       // element.textContent = `${attr.attract.slice(1)}`
        
        //\n(${forceX.toFixed(2)}, ${forceY.toFixed(2)})`;
        element.style.display = "flex";
        element.style.alignItems = "center";
        element.style.justifyContent = "center";
        element.style.fontWeight = "bold";
       // alert(element)
        this.res.appendChild(element);

    });

   return this;
}


    add(items){
      this.items = items;
        
        // Render each component in the grid container
        for (const component of items) {
            this.res.appendChild(component.render());
           // alert("PP");
       //    console.log("ORAA");
        }

           //   alert("PP");

        if (this.storedPositions){
            this.generateGridPositions(this.storedPositions);
            
        }

       
        return this;
    }


        toCode() {
            if (this.excludeFromCodeTrue){
                return [""];
            }
    
            const objString = toObjectSource(this.options, 4);
    

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


        if (div){
            document.querySelector(div).appendChild(this.res);
            return;
        }

        

     //   alert("PP");
        return this.res;
    }
}
export { Free };
