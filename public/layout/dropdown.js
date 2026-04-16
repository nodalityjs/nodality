import {Animator} from "./animator.js";

 

// 1st internal class
class DropdownOld extends Animator { // 232811
    constructor(items, title){
        super();
        this.setup(items, title);
        this.adjustSubmenu();
        window.addEventListener("resize", () => {
    this.adjustSubmenu();
    
        });
    
    
    
    }
    
     adjustSubmenu = () => {
    
            
        if (window.matchMedia("(max-width: 600px").matches){
            //alert("K")
            console.log("TORELATIVE");
            this.res.children[1].style.position = "relative";
            
        } else {
            console.log("TOABSOLUTE");
            this.res.children[1].style.position = "absolute"; // WOW !!!
        }
    }
    
    setup(items, title) {
        let el = document.createElement("div");
        el.style.display = "flex";
    
        let span = document.createElement("span");
        let nodes = document.createTextNode(title);
        span.appendChild(nodes);
        el.appendChild(span);
    
        let content = document.createElement("div");
        content.style.width = "200px";
        content.style.marginTop = "30px"
        //content.style.right = "initial"; // was 0 to fit 175642
        // content.style.left = "auto"
        content.style.background = "white";
        content.style.padding = "0.4rem";
        content.style.borderRadius = "0.4rem";
    
    
    
        content.style.display = "none" //"none";
        content.style.flexDirection = "column";
        content.style.position = "absolute"; // WOW !!!
    
    
    
    
        /*
    var rect = dropDownDiv.getBoundingClientRect();
    if (rect.x + rect.width > window.innerWidth){
       // top: 0;
       // left: "auto";
    }*/
    
    
    
        
        /*let covid = document.querySelector("#covid");
        if (covid.style.flexDirection === "column"){
            content.style.position = "relative"; // WOW !!!
        }*/
    
        if (window.matchMedia("(max-width: 70em").matches){
            //alert("K")
            content.style.position = "relative"; 
            //content.style.right = 0; // was 0 to fit 175642
        content.style.left = "initial";
    
        el.style.display = "flex";
        el.style.flexDirection = "column";
        el.style.alignItems = "center";
    
        } else {
            //content.style.right = 6; // was 0 to fit 175642
        content.style.left = "auto";
            content.style.position = "absolute"; // WOW !!!
        }
    
    
    
        for (var i = 0; i < items.length;i++){
            /*let contentP = document.createElement("p");
            contentP.style.whiteSpace = "normal"; // 234855
            contentP.style.background = "green";
            //contentP.style.maxWidth = `50px`;
            contentP.style.wordBreak = "break-all"
            let nodesa = document.createTextNode(items[i].name);
            contentP.appendChild(nodesa);
            content.appendChild(contentP);*/
    
            let link = new Link(items[i].name,items[i].url).toBlock().render();
            link.style.textAlign = "left";
            // link.style.backgroundColor = "green";
            link.style.wordBreak = "break-all"
            content.appendChild(link);
            
        }
    
        el.appendChild(content);
    
        
    
    
    
    
        this.res = el;
        this.behavior();
    }
    
    behavior(){
    this.res.addEventListener("mouseover", () => {
        
        this.res.children[1].style.display = "flex";
    
    const rect = this.res.children[1].getBoundingClientRect()
        if (rect.x + rect.width > window.innerWidth){ // WOW !!!
            // 22:14:26 28/07/22 WOW HAPPY NOW !!!
            this.res.children[1].style.right = 0;
            this.res.children[1].style.left = "initial";
        }
    });
    
    this.res.children[1].addEventListener("mouseout", () => {
        this.res.children[1].style.display = "none";
    });
    }
    
    
    items(arr){
    
    }
    
    
    render(){
    return this.res; // only internaly
    }
    
    
    
    }
export { DropdownOld };
