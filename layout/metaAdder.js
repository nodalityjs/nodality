/*!
 * nodality v1.0.0-beta.53
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

class MetaAdder{
    constructor(){ 
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
