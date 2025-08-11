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
