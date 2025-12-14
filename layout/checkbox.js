import { Animator } from "./animator.js";

class Checkbox extends Animator {
    constructor() {
        super();
        this.el = null;

		
    }

    set(obj) {
     this.options = obj;

	  // Set default clipPath if not provided
        //this.options.clipPath =
          //  this.options.clipPath; //|| "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)";

    // Create the container div
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.alignItems = "center";

    // Create the checkbox input
    const input = document.createElement("input");
    input.type = "checkbox";
    input.style.position = "relative";
    input.style.marginRight = "0.5rem";

    // Set size and custom appearance
    const size = obj.size || "24px";
    input.style.width = size;
    input.style.height = size;

	if (obj.customStyle){
     input.style.appearance = "none";
	}
	
    input.style.border = "2px solid #ccc";
    input.style.borderRadius = "4px";
    input.style.backgroundColor = obj.backgroundColor || "white";
    input.style.cursor = "pointer";
    input.style.transition = "background-color 0.2s ease, border-color 0.2s ease";

    // Custom checkmark via ::after
    input.style.display = "inline-block";
    input.style.setProperty("--checked-bg-color", obj.checkedBackgroundColor || "#4CAF50");
    input.style.setProperty("--checkmark-color", "white");
	input.style.setProperty("--checkmark-clip-path", this.options.clipPath ?? "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)");

   const style = document.createElement("style");
style.textContent = `
    input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none; /* For Safari */
        width: var(--size, 24px);
        height: var(--size, 24px);
        border: 2px solid #ccc;
        border-radius: 4px;
        background-color: white;
        position: relative;
        cursor: pointer;
        transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    input[type="checkbox"]:checked {
        background-color: var(--checked-bg-color, #4CAF50);
        border-color: var(--checked-bg-color, #4CAF50);
    }

    input[type="checkbox"]::after {
        content: '';
        position: absolute;
        width: 50%;
        height: 50%;
        top: 25%;
        left: 25%;
        transform: scale(0);
        background-color: var(--checkmark-color, white);
        clip-path: var(--checkmark-clip-path);
        -webkit-clip-path: var(--checkmark-clip-path);
        transition: transform 0.2s ease;
    }

    input[type="checkbox"]:checked::after {
        transform: scale(1);
    }
`;

if (obj.customStyle){
document.head.appendChild(style);
}

obj.mar && this.mar(obj.mar);
obj.pad && this.pad(obj.pad);
obj.respad && this.respad(obj.respad);
obj.resmar && this.resmar(obj.resmar);

    // Event to toggle background and border
    input.addEventListener("change", () => {
        if (input.checked) {
            input.style.backgroundColor = obj.checkedBackgroundColor || "#4CAF50";
            input.style.borderColor = obj.checkedBackgroundColor || "#4CAF50";
        } else {
            input.style.backgroundColor = obj.backgroundColor || "white";
            input.style.borderColor = "#ccc";
        }
    });

    // Set name attribute if provided
    if (obj.name) {
        input.setAttribute("name", obj.name);
    }

    div.appendChild(input);

    // Add label
    const labelDiv = document.createElement("div");

    if (typeof obj.label?.render === "function") {
        labelDiv.appendChild(obj.label.render());
    } else {
        const labelText = document.createTextNode(obj.title || "Label");
        labelDiv.appendChild(labelText);
    }

    // Apply label styles
    labelDiv.style.opacity = 0.8;
    labelDiv.style.transition = "opacity ease 0.2s, transform ease 0.2s";

    div.appendChild(labelDiv);

    this.el = div;
    return this;
    }

    getValue() {
        return this.el.children[0].checked;
    }

    toCode() {
       /* let objString = JSON.stringify(this.options, null, 4);
        objString = objString.replace(/"(\w+)"(?=\s*:)/g, '$1');
        return [`new Checkbox().set(${objString})`];*/

		const entries = Object.entries(this.options)
        .map(([key, value]) => {
            if (typeof value === "string") {
                return `${key}: "${value}"`; // Wrap strings in quotes
            } else if (typeof value === "object" && value !== null) {
                if (typeof value.toCode === "function") {
                    // Call the object's toCode method if available
                    return `${key}: ${value.toCode()[0]}`;
                } else {
                    // Fallback for plain objects
                    return `${key}: ${JSON.stringify(value, null, 4)}`;
                }
            } else {
                return `${key}: ${value}`; // Handle numbers, booleans, etc.
            }
        })
        .join(",\n    ");


    return [`new Checkbox().set({\n    ${entries}\n})`];
    }

    margin(amount) {
        this.el.style.margin = amount;
        return this;
    }

    render(div) {
        if (div) {
            document.querySelector(div).appendChild(this.el);
        } else {
            return this.el;
        }
    }
}

// Export the class
window.Checkbox = Checkbox;
export { Checkbox };
