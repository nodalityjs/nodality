/*!
 * nodality v1.2.1
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class MetaAdder extends Animator{
    constructor(){
		super();
		// Converted from a standalone class. Opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour; opt in per component.
		this._noTheme = true; 
        this.res = document.createElement("meta");
        this.res.setAttribute("name", "viewport");
        this.res.setAttribute("content", "width=device-width, initial-scale=1");
        this.charset = document.createElement("meta");
        this.charset.setAttribute("charset", "UTF-8");
    }
    
    add(){
        document.head.appendChild(this.res);
        document.head.appendChild(this.charset);
    }
}
export { MetaAdder };
