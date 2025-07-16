import {Animator} from "./animator.js";

class SideNav extends Animator {
    constructor() {
        super();
    }

    setup(obj) {
        this.obj = obj; // this.obj.animate || true LOL    this.obj.animate ? this.obj.animate : true
        this.animate = this.obj.animate !== undefined ? this.obj.animate : true; // could be never false
        this.res = this.createSideNav(obj);
        this.res.style.position = "relative";
        this.res.style.zIndex = 3;
        this.closed = true; // Set to true initially, so it's closed by default
        return this;
    }

    toggleSideNav(button) {
        this.closed = !this.closed;
        let sideNavWrapper = this.res.children[0];
        let duration = 300; // 3000

        if (this.closed) { // Began 13/11/24
            sideNavWrapper.style.overflowX = "hidden";
            button.style.opacity = 1;   // Show toggle button

            if (this.animate) {
                // Animate hiding with translateX
                sideNavWrapper.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], {
                    duration: duration,
                    fill: 'forwards'
                });

                let idx = -1;

                for (let childa of sideNavWrapper.children) {
                    idx += 1;

                    // THIS CONTROLS CLOSING

                    if (this.masterEL[idx]){

                    
                    for (let child of childa.children) {
                        let anna = this.masterEL[idx].options.animation;
                        if (anna && this.mappedIDS.includes(child.id)) {
                            child.animate(anna.op.keyframesClose, anna.op.closeOptions);
                        }
                    }
                }
                }
            } else {
                sideNavWrapper.style.display = "none"; // Hide navigation immediately
            }
        } else {


            // THIS BLOCK CONTROLE APPEARING !!!!!!!!!


            sideNavWrapper.style.overflowX = "none";
            sideNavWrapper.children[1].style.border = "1px solid orange";


            let idx = -1;

            for (let childa of sideNavWrapper.children) {
                idx += 1;

                for (let child of childa.children) {
                    if (this.mappedIDS.includes(child.id)) {
                    
                       if (this.masterEL[0] !== undefined){

                       
                        let anna = this.masterEL[idx].options.animation;
                        

                            if (anna){

                            
                            console.log("OPEN KEYFRAMES");
                            console.log(anna.op.keyframesOpen);
                         
                            let opts = anna.op.openOptions;
                        
                            /// FIX
                            if (!opts.delay){
                                opts.delay = 1;
                            }

                            if (!opts.duration){
                                opts.duration = 300;
                            }

                            console.log(opts);
                            
                            // Why does duration affect navigation appearing????
                           //THIS BLOCK CONTROLS APPEARING !!!!
                            /*let protoOps = {
                                duration: 300,
                                fill: 'forwards',
                                delay: 1000 // 1000 why does 3000 work during open but not during close??
                            };*/
                           
                            child.animate(anna.op.keyframesOpen, opts);
                            }

                        }



                    }
                }
            }

            button.style.opacity = 0;
            if (this.animate) {
                sideNavWrapper.style.display = "flex"; // Ensure it's visible
                sideNavWrapper.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], {
                    duration: duration,
                    fill: 'forwards'
                });
            } else {
                sideNavWrapper.style.display = "flex"; // Show navigation immediately
            }
        }
    }

    createToggleButton(color) {
        const button = document.createElement("button");
        button.innerText = "☰";
        button.style.padding = "10px 20px";
        button.style.backgroundColor = "transparent";
        button.style.color = color ?? "#3498db";
        button.style.border = "none";
        button.style.borderRadius = "5px";
        button.style.cursor = "pointer";
        button.style.zIndex = 1;
        button.style.fontSize = "1.6rem";
        return button;
    }

    createCloseButton(color) {
        const button = document.createElement("button");
        button.innerText = "×";
        button.style.fontSize = "1.6rem";
        button.style.padding = "10px 20px";
        button.style.backgroundColor = "transparent";
        button.style.color = color ?? "black";
        button.style.border = "none";
        button.style.borderRadius = "5px";
        button.style.cursor = "pointer";
        button.style.zIndex = 1;
        button.style.alignSelf = "flex-end"; // Align close button to the right
        return button;
    }

    createSideNav(obj) {
        const megaWrapper = document.createElement("div");
        megaWrapper.style.display = "flex";
        megaWrapper.style.justifyContent = "flex-end";

        const sideNavWrapper = document.createElement("div");
        sideNavWrapper.style.display = "none";
        sideNavWrapper.style.background = this.obj.background || "#1abc9c";
        sideNavWrapper.style.height = "100%";

        let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);
        if (mobileMedia.matches) {
            sideNavWrapper.style.width = "100%";
        } else {
            sideNavWrapper.style.width = this.obj.width || "400px"; // or width
        }

        sideNavWrapper.style.position = "fixed";
        sideNavWrapper.style.right = 0;
        if (this.animate) {
            sideNavWrapper.style.transform = "translateX(100%)"; // Start off-screen
        }
        sideNavWrapper.style.flexDirection = "column";
        sideNavWrapper.style.justifyContent = "flex-start";

        const toggleBtn = this.createToggleButton(this.obj.hamColour.opened);
        const closeBtn = this.createCloseButton(this.obj.hamColour.closed);

        toggleBtn.addEventListener("click", () => this.toggleSideNav(toggleBtn));
        closeBtn.addEventListener("click", () => this.toggleSideNav(toggleBtn));

        sideNavWrapper.appendChild(closeBtn);
        megaWrapper.appendChild(sideNavWrapper);
        megaWrapper.appendChild(toggleBtn);
        return megaWrapper;
    }

    items(it) {
        this.masterEL = it.items.filter(it => it.link !== undefined);

        console.log("EXTRACT IDs");
        console.log(it);

        let mappedIDS = it.items
        .filter(it => it.items === undefined)
        .map(id => id.id);

        this.mappedIDS = mappedIDS;
        this.item = it;
        this.res.children[0].appendChild(it.render());


        if (this.masterEL[0] !== undefined){

        console.log("ANNAX");
        console.log(this.masterEL[0]);

        let anna = this.masterEL[0].options.animation;
       


        // Set initialState from animation here
        if (anna) {
            for (let childa of this.res.children[0].children) {
                for (let child of childa.children) {
                    if (this.mappedIDS.includes(child.id)) {

                    let resetDelay = anna.op.closeOptions;
                    resetDelay.delay = 0;

                    console.log("ANNAX");
                    console.log("SETTING INITIAL STATE ZEROING THE DELAY");
                    console.log(anna.op.keyframesClose);
                    console.log(resetDelay);
                    
                    



                     // OPEN KEYFRAMES LOG IS FROM FUNCTION THAT HAS COMMENTE OUT ACXTION!!!
                    // MATCH CLOSE OBJECT


                  /*  child.animate([ 
                        { transform: 'translate(0%)', opacity: 1 },
                        { transform: 'translate(100%, 10%)', opacity: 0 }
                    ], { duration: 1,
                         fill: 'forwards',
                         delay: 0 // hide immediatelly even before the nav shows
                        });
                  
                    */


                        child.animate(anna.op.keyframesClose, anna.op.closeOptions);


                    // child.animate(anna.op.keyframesOpen, resetDelay);






                    
                    }
                }
            }
        }

    }
        return this;
    }

   /* toCode() {
        let codeStr = `new SideNav().setup(${JSON.stringify(this.obj, null, 2)}, ${this.animate})`;
        if (this.item) {
            let itemCode = this.item.toCode ? this.item.toCode().join("") : JSON.stringify(this.item);
            itemCode = itemCode.replace(/,\s*(\.set\(|\.add\()/g, "\n  $1");
            codeStr += `.items(${itemCode})`;
        }
        return codeStr;
    }*/

        toCode() {
            // Convert object to string with JSON.stringify
            let codeStr = `new SideNav().setup(${this.formatObj(this.obj)})`;
            
            if (this.item) {
                let itemCode = this.item.toCode ? this.item.toCode().join("") : this.formatObj(this.item);
                itemCode = itemCode.replace(/,\s*(\.set\(|\.add\()/g, "\n  $1");
                codeStr += `.items(${itemCode})`;
            }
            
            return codeStr;
        }
        
        // Utility method to format object strings and remove quotes from keys
        formatObj(obj) {
            // Use JSON.stringify to get a string with indentation
            let jsonString = JSON.stringify(obj, null, 2);
            
            // Remove quotes around object keys using regex
            return jsonString.replace(/"(\w+)"\s*:/g, '$1:');
        }

    render(mount) {
        if (mount) {
            document.querySelector(mount).appendChild(this.res);
        }
        return this.res;
    }
}
 
export { SideNav };
