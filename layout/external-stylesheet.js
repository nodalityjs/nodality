/*!
 * nodality v1.0.205
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

 class ExternalStylesheet extends Base {
        constructor(link){
            super();
            this.link = link;
        }

        render(){
            let el = document.createElement("link");
            el.setAttribute("rel", "stylesheet");
            el.setAttribute("href", this.link);
            document.getElementsByTagName( "head" )[0].appendChild( el );
            return el;
        }
    }


export { ExternalStylesheet };
