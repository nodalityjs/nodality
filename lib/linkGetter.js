class LinkStyler {
    static style(obj){
        let bst = obj.bst;
        let el = obj.el;
        let re = obj.re;
        let customOptions = obj.options;
        let links = [];

        for (var j = 0; j < bst.length; j++){
            //console.log("LOOP" + j)

           
            
    
       
                let allow = true;
    
               
                if(bst[j].target){
                //    alert("Target");
                    allow = false;
                    
                   // alert(el.id);
                   // alert("=")
                   // alert(bst[j].target[0]); // j is always 9
                    if (el.id === bst[j].target[0]){
                        allow = true;
                        
                    }
                }
            

           // console.log("ALLOW" + allow)


        }
      //  alert(bst.length);
        for (var j = 0; j < bst.length; j++){
          //  console.log(customOptions.filter(l => l.op.name === "shadow"));
         
          // console.log("JIOH" + j);
       
                let allow = true;
    
               
                if(bst[j].target){
                //    alert("Target");
                    allow = false;
                    
                   // alert(el.id);
                   // alert("=")
                   // alert(bst[j].target[0]); // j is always 9
                    if (el.id === bst[j].target[0]){
                        allow = true;
                        
                    }
                }

                let split = bst[j].op.ops.split("-");

               // alert(allow);
    
               /* let split = bst[j].op.ops.split("-");
    
                if(allow && split.includes("round")){
                    re["borderObj"] = {width: 3, radius: "0.7rem", color: bst[j].op.style.color};
                    re["color"] = bst.op.style.color;
                }
    
                if(allow && split.includes("full")){
                    re["background"] = "#3498db";
                    re["borderObj"] = {radius: "0.3rem"};
                    re["color"] = "white";
                }
    
                if(allow && split.includes("pill")){
                    re["background"] = "#3498db";
                    re["borderObj"] = {radius: "9999px"};
                    re["color"] = "white";
                }
    
                if(allow && split.includes("border")){
                    re["background"] = "#3498db";
                  //  alert(bst[j].op.style.bc);
                
                  if (!re["borderObj"]){
                    re["borderObj"] = {radius: "0.3rem"};
                  }
               
                    re["borderObj"]["color"] = bst[j].op.bc ?? "orange";
                    re["borderObj"]["width"] = 3;
                    re["color"] = "white";
                }
    
                if(allow && split.includes("air")){
                    re["background"] = "transparent";
                    re["color"] = "#1abc9c";
                }
    
                if(allow && split.includes("hover")){
                   re["hover"] = {color:  re["background"] === "transparent" ? "white" : re["background"], background: re["color"], border: true, animation: 0.3}; //{color: "#1abc9c"};
                }
    
    */

                if (allow && split.includes("air")){
                    re["borderObj"] = {color: "#1abc9c", radius: "0rem", width: "3px"};
                    re["color"] = "#1abc9c";
                    re["background"] = "transparent";
                }

                if(allow && split.includes("round")){
                   if (!split.includes("air")){

                   
                    re["borderObj"] = {width: "0px", radius: "0.7rem", color: "#1abc9c"};
                   } else {
                    re["borderObj"] = {width: "4px", radius: "0.7rem", color: "#1abc9c"};
                   }
                  
                    //re["color"] = "#1abc9c";//bst.op.style.color;
                }
    
                if(allow && split.includes("full")){
                    re["background"] = "#3498db";
                    if (re["borderObj"] && re["borderObj"]["radius"]){
                        re["borderObj"]["radius"]  = "0.3rem"; // = {radius: "0.3rem"};
                    } else
                    re["color"] = "white";
                }
    
                if(allow && split.includes("pill")){
                    re["background"] = "#3498db";
                    re["borderObj"]["radius"] = "9999px"; 
                  //  re["borderObj"] = {radius: "9999px"};
                    re["color"] = "white";
                }
              
                if(allow && split.includes("hover")){ // PASS THE COLOR HERE
                   /* re["hover"] = {
                         color:  "#1abc9c",
                         background: "orange",// re["color"],
                        // border: {
                          //  width: 3,
                         //   color: re["borderObj"]["color"]//"green"
                        //    },
                         animation: 0.3
                        }; //{color: "#1abc9c"};


                        if (re["borderObj"] && re["borderObj"]["color"]){
                            re["hover"]["border"]["color"] = re["borderObj"]["color"]
                        }*/



                            
                            re["hover"] = {
                                color:  "#1abc9c",
                                background: "orange"
                            }
                 } 
               
           
           
          
           
    
            
         
            
            //re["linkStyle"] = customOptions.filter(l => l.op.name === "link-style")[0],
            //re["gradient"] = customOptions.filter(l => l.op.name === "gradient")[0],
           
           /* ela = new Link().set({ NOT WORKING
                id: el.id,
                text: "A",
                backgroundOp: {range:["0px","900px"],op:{name:"background",color:"#1abc9c",margin:"1rem"},target:["#swim","#cleanLink"]},
            });*/
    
            // console.warn("TRANSFORMERS");
            // console.warn(re["backgroundOp"]);
           
           
           // ela = new Link().set(re);

           links.push(new Link().set(re));
    
    
         
           
            
           
        }

        return links;
   }
   
}


export {LinkStyler};