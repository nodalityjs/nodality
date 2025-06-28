import { Animator } from "./animator.js";

class Dropdown extends Animator {
    constructor() {
        super();
        this.res = document.createElement("div");

        // Wrapper for the collapsed dropdown
        this.toggleWrap = document.createElement("div");
     //   this.toggleWrap.style.background = "olive";
        this.toggleWrap.style.zIndex = 9999;
        this.toggleWrap.style.borderRadius = "0.3rem";
       //this.toggleWrap.style.width = "200px"; // Explicit width for collapsed dropdown
        this.toggleWrap.style.height = "40px"; // Fixed height for collapsed dropdown
        this.toggleWrap.style.cursor = "pointer";
        this.toggleWrap.style.display = "flex";
        this.toggleWrap.style.alignItems = "center";
        this.toggleWrap.style.justifyContent = "center";
        this.res.appendChild(this.toggleWrap);

        // Container for dropdown content
        this.contentWrap = document.createElement("div");
        this.contentWrap.style.position = "absolute";
        this.contentWrap.style.background = "#ecf0f1";
        this.contentWrap.style.borderRadius = "0.3rem";
        this.contentWrap.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.15)";
        this.contentWrap.style.marginTop = "10px"; // Visual separation
        this.contentWrap.style.width = "250px"; // Explicit width for dropdown content
        this.contentWrap.style.display = "none"; // Hidden by default

        this.res.appendChild(this.contentWrap);

        this.styles = {};
        this.children = [];
        this.isExpanded = false;

        this.toggleWrap.addEventListener("click", () => this.toggle());

       
    }

    set(obj) {
        this.options = obj;

        if (obj.title) {
            this.toggleWrap.textContent = obj.title;
        }

        if (obj.width) {
            this.toggleWrap.style.width = obj.width;
        }

        if (obj.contentWidth) {
            this.contentWrap.style.width = obj.contentWidth;
        }

        if (obj.background) {
            this.contentWrap.style.backgroundColor = obj.background;
        }

        obj.mar && this.mar(obj.mar);//alert("/")


        const adjust = () => {
          //  alert("OBJA");
          //  alert(obj.breakpoint);
            let media2 = window.matchMedia(`(max-device-width: 415px)`);
            let smallScreen = window.matchMedia(`(max-width: ${obj.breakpoint ?? "600px"})`); // was 600px

            if (media2.matches || smallScreen.matches) {
                this.contentWrap.style.position = "relative";
            } else {
                this.contentWrap.style.position = "absolute";
            }
        };

        window.addEventListener("resize", adjust);
        adjust();


        return this;
    }

    add(children) {
      if (!Array.isArray(children)) {
          throw new Error("The 'add' method expects an array of children.");
      }
  
      children.forEach((child, i) => {
if (i !== 0){


          if (child.res instanceof HTMLElement) {
              this.contentWrap.appendChild(child.res);
          } else {
              throw new Error("Each child must have a valid 'element' property that is an HTMLElement.");
          }
        }

      });
  
      // Set the first child as the title of the toggleWrap if no title is explicitly set
      if (!this.options || !this.options.title) {
          const firstChild = children[0];
          if (firstChild && firstChild.res) {
            this.toggleWrap.appendChild(firstChild.res);
            //  this.toggleWrap.textContent = firstChild.res.textContent || "Dropdown";
          }
      }
  
      this.children.push(...children);
      return this;
  }
  

    toggle() {
        this.isExpanded = !this.isExpanded;
        this.contentWrap.style.display = this.isExpanded ? "block" : "none";
    }

    toCode() {
        const props = this.options
            ? Object.entries(this.options)
                  .map(([key, value]) => {
                      if (typeof value === "string") return `${key}: \"${value}\"`;
                      if (typeof value === "object") return `${key}: ${JSON.stringify(value)}`;
                      return `${key}: ${value}`;
                  })
                  .join(",\n  ")
            : "";

        let finalCode = this.children
            .map((el, i) =>
                el
                    .toCode()
                    .flatMap((l) => l)
                    .join("") + (i < this.children.length - 1 ? "," : "")
            )
            .join("");

        return [`new Dropdown().set({\n  ${props}\n}).add([\n ${finalCode}\n])`];
    }

    render(id) {
        if (id) {
            document.querySelector(id).appendChild(this.res);
        }
        return this.res;
    }
}

export { Dropdown };