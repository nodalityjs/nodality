

class CustomDivRenderer {
    constructor(obj, items) {
        this.obj = obj || {};
        this.items = items || [];
    }

     render() {
        // Create inner div with flex display
        let tempDiv = document.createElement("div");
        tempDiv.style.display = "flex";
        tempDiv.style.width = "100%";
        tempDiv.style.justifyContent = "space-around";
        tempDiv.setAttribute("id", "innerItemsWrapper");
        
        let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);
        let media = window.matchMedia(`(max-width: 600px)`);

        if (mobileMedia.matches || media.matches){
            tempDiv.style.marginTop = "3rem";
        }

      //  console.log("ITEMS ARE ORDERED");
      //  console.log(this.items);

        // Append rendered items to inner div
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            tempDiv.appendChild(item.render());
        }

        // Create outer div and apply styling based on obj properties
        let outerDiv = document.createElement("div");
        outerDiv.style.width = this.obj.isSide ? "333px" : "100%";
        outerDiv.style.background = this.obj.background || "white";
        outerDiv.style.display = "flex";
        outerDiv.style.justifyContent = "center";
        outerDiv.style.alignItems = "center";
        outerDiv.style.height = "100%";
        outerDiv.setAttribute("id", "outerItemsWrapper");
        outerDiv.appendChild(tempDiv);

        // Apply custom styles if specified in obj
        if (this.obj.customStyle) {
            tempDiv.style.width = "auto";
            tempDiv.style.top = "0rem";
            tempDiv.style.borderRadius = "1rem";
            tempDiv.style.background = this.obj.background || "white";
            tempDiv.style.margin = "1rem";
            tempDiv.style.position = "absolute";
            tempDiv.style.opacity = 0.8;
        }

        return outerDiv;
    }
}

window.CustomDivRenderer = CustomDivRenderer;
export { CustomDivRenderer };
