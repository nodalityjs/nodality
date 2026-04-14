import { Animator } from "./animator.js";

class Dropdown extends Animator {
    constructor() {
        super();
        this.res = document.createElement("div");
        this.res.style.position = "relative";

        // Wrapper for the collapsed dropdown
        this.toggleWrap = document.createElement("div");
        this.toggleWrap.style.zIndex = 9999;
        this.toggleWrap.style.borderRadius = "0.3rem";
        this.toggleWrap.style.cursor = "pointer";
        this.toggleWrap.style.display = "flex";
        this.toggleWrap.style.alignItems = "center";
        this.toggleWrap.style.justifyContent = "center";
        this.res.appendChild(this.toggleWrap);

        // Container for dropdown content — appended to body to escape overflow clipping
        this.contentWrap = document.createElement("div");
        this.contentWrap.style.position = "fixed";
        this.contentWrap.style.background = "#ecf0f1";
        this.contentWrap.style.borderRadius = "0.3rem";
        this.contentWrap.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.15)";
        this.contentWrap.style.width = "250px";
        this.contentWrap.style.display = "none";
        this.contentWrap.style.zIndex = 99999;
        document.addEventListener("DOMContentLoaded", () => {
            document.body.appendChild(this.contentWrap);
        });
        // Fallback if DOM is already loaded
        if (document.body) {
            document.body.appendChild(this.contentWrap);
        }

        this.styles = {};
        this.children = [];
        this.isExpanded = false;
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

         if (obj.radius) {
            this.contentWrap.style.borderRadius = obj.radius;
        }

        // Center the popup under the toggle, clamp to viewport edges.
        const positionContent = () => {
          const tRect = this.toggleWrap.getBoundingClientRect();
          // Ensure width is measurable even while hidden.
          const prevDisplay = this.contentWrap.style.display;
          const prevVisibility = this.contentWrap.style.visibility;
          if (prevDisplay === "none") {
            this.contentWrap.style.visibility = "hidden";
            this.contentWrap.style.display = "block";
          }
          const cRect = this.contentWrap.getBoundingClientRect();
          if (prevDisplay === "none") {
            this.contentWrap.style.display = prevDisplay;
            this.contentWrap.style.visibility = prevVisibility || "";
          }

          const margin = 8;
          const vw = window.innerWidth;
          const toggleCenter = tRect.left + tRect.width / 2;
          let left = toggleCenter - cRect.width / 2;
          if (left < margin) left = margin;
          if (left + cRect.width > vw - margin) left = vw - margin - cRect.width;
          if (left < margin) left = margin; // if content wider than viewport

          this.contentWrap.style.top = (tRect.bottom + 4) + "px";
          this.contentWrap.style.left = left + "px";
        };
        this._positionContent = positionContent;

        // Reposition on resize/scroll while open.
        const maybeReposition = () => {
          if (this.contentWrap.style.display !== "none") positionContent();
        };
        window.addEventListener("resize", maybeReposition);
        window.addEventListener("scroll", maybeReposition, true);

        if (obj.behaviour) {
  const ev = obj.behaviour;

  if (ev === "mouseover" || ev === "mouseenter") {
    let hoverTimeout;

    const show = () => {
      clearTimeout(hoverTimeout);
      this.contentWrap.style.display = "block";
      positionContent();
    };

    const hide = () => {
      hoverTimeout = setTimeout(() => {
        this.contentWrap.style.display = "none";
      }, 200);
    };

    this.toggleWrap.addEventListener("mouseenter", show);
    this.toggleWrap.addEventListener("mouseleave", hide);
    this.contentWrap.addEventListener("mouseenter", show);
    this.contentWrap.addEventListener("mouseleave", hide);

    // Touch / tap support (mobile has no hover)
    this.toggleWrap.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = this.contentWrap.style.display === "block";
      if (open) {
        this.contentWrap.style.display = "none";
      } else {
        this.contentWrap.style.display = "block";
        positionContent();
      }
    });
    document.addEventListener("click", (e) => {
      if (this.contentWrap.style.display === "block"
          && !this.contentWrap.contains(e.target)
          && !this.toggleWrap.contains(e.target)) {
        this.contentWrap.style.display = "none";
      }
    });

  } else if (ev === "click") {
    this.res.addEventListener("click", () => {
      this.toggle();
      if (this.contentWrap.style.display === "block") positionContent();
    });

  } else {
    this.res.addEventListener(ev, () => {
      this.contentWrap.style.display = "block";
      positionContent();
    });
  }

} else {
  this.res.addEventListener("click", () => {
    this.toggle();
    if (this.contentWrap.style.display === "block") positionContent();
  });
}
      

        obj.mar && this.mar(obj.mar);//alert("/")

         obj.pad && this.pad(obj.pad);
   
    obj.respad && this.respad(obj.respad);
    obj.resmar && this.resmar(obj.resmar);
       // this.commonMethods(obj); not yet

        // Position is always fixed (appended to body), no breakpoint adjustment needed


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