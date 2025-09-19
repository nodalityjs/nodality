/*!
 * nodality v1.0.23
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "../layout/animator.js";
import {Text} from "../layout/text.js";
import {Image} from "../layout/image.js";
import {Link} from "../layout/link.js";
import {FlexRow} from "../layout/flexRow.js";
import {UINavBar} from "../layout/newNavBar.js";
import { /*Beta*/DesktopBar } from "../layout/betaDesktopBar.js";
import { /*Beta*/MobileBar } from "../layout/betaMobileBar.js";
import { /*Multi*/Switcher } from "../layout/multiswitcher.js";
import { Dropdown } from "../layout/dropdown2025.js";
import { Wrapper } from "../layout/container.js";
import { SideNav } from "../layout/sideNavBar.js";
import { Spacer } from "../layout/spacer.js";
//22:58:29 I won!!!

// 16/04/25 18:39:40 Nice!!! 
// FORM COMPONENTS
import { FloatingInput } from "../layout/formComponents/floatingInput.js";
import { Range } from "../layout/formComponents/range.js";
import { RadioGroup } from "../layout/formComponents/radio.js";
import { Picker } from "../layout/formComponents/picker.js";
import { FilePickera } from "../layout/formComponents/imagePicker.js";
import { DataList } from "../layout/formComponents/dataList.js";
import { Base } from "../layout/base.js";
import { Form } from "../layout/formComponents/form.js";
import { Button } from "../layout/button.js";
import { Slider } from "../layout/slider2025.js";
import { Audio } from "../layout/audionew.js";
import { Video } from "../layout/video.js";
import { Table } from "../layout/table.js";
import { Modal } from "../layout/modal2025.js";
import { Code } from "../layout/code.js";
import { Free } from "../layout/free.js";
import { Checkbox } from "../layout/checkbox.js";
import { Stack } from "../layout/stack.js";
import { LinkStyler } from "../lib/linkGetter.js";
import { CardGen } from "../lib/cardGetter.js";
import {AreaSwitcher} from "../layout/gridSwitcher.js";
import {HScroller} from "../layout/horizontalScroller.js";
import { UList } from "../layout/ulist.js";

// SHAPES
import { Polygon } from "../layout/polygon.js";
import { Circle } from "../layout/circle.js";

class ElementMapper { // 22:09:58 04/11/2024
   static mapType(obj) {
  // console.log("LOBJ");
   // console.log(obj);
        let headings = ["h1", "h2", "h3", "h4", "h5", "h6", "p"];
        if (headings.includes(obj.el.type)) {
            return this.mapText(obj);
        } else if (obj.el.type === "img"){
            return this.mapImage(obj);
        } else if (obj.el.type === "a"){
            return this.mapLink(obj);
        }  else if (obj.el.type === "cards"){
            return this.mapGrid(obj);
        } /*else if (obj.el.type === "cdiv"){
            return this.mapCDiv(obj);
        } */else if (obj.el.type === "free"){
            return this.mapFree(obj);
        } else if (obj.el.type === "nav"){ // protoNav
            return this.protoNav(obj);
        } else if (obj.el.type === "sideNav"){
            return this.sideNav(obj);
        } else if (obj.el.type === "row"){
            return this.mapRow(obj); // back
        }  else if (obj.el.type === "dropdown"){
            return this.dropdown(obj);
        } else if (obj.el.type === "radio"){ // FORM ELEMENTS
           // alert("PP")
            return this.radio(obj);
        } else if (obj.el.type === "input"){
            // alert("PP")
             return this.input(obj);
         } else if (obj.el.type === "labelInput"){ 
            // alert("PP")
             return this.floatInput(obj);
         } else if (obj.el.type === "filePicker"){ 
            // alert("PP")
             return this.filePicker(obj);
         } else if (obj.el.type === "picker"){ 
            // alert("PP")
             return this.picker(obj);
         } else if (obj.el.type === "video"){ 
            // alert("PP")
             return this.video(obj);
         } else if (obj.el.type === "audio"){ 
            // alert("PP")
             return this.audio(obj);
         } else if (obj.el.type === "multiswitcher"){ 
            // alert("PP")
             return this.multiswitcher(obj);
         } else if (obj.el.type === "button"){ 
            // alert("PP")
             return this.button(obj);
         } else if (obj.el.type === "form"){
            return this.form(obj);
         } else if (obj.el.type === "checkbox"){
            return this.checkbox(obj);
         } else if (obj.el.type === "stack"){
            return this.stack(obj);
         } else if (obj.el.type === "simple"){
            return this.simple(obj);
         } else if (obj.el.type === "copy"){
            return this.mapCopy(obj);
         } else if (obj.el.type === "wrap"){
            return this.mapWrap(obj);
         } else if (obj.el.type === "circle"){
            return this.mapCircle(obj);
         } else if (obj.el.type === "polygon"){
            return this.mapPolygon(obj);
         } else if (obj.el.type === "code"){
            return this.mapCode(obj);
         } else if (obj.el.type === "table"){
            return this.mapTable(obj);
         } else if (obj.el.type === "ulist"){
            return this.mapUList(obj);
         }
    }

    static mapTable(obj){


         let el = obj.el;
        console.log("///");
        console.log(el);

    return new Table()
        .add([
            { abbr: "AUIUI/AK9PT", name: "Pokročilé mobilní technologie", grade: "A", date: "09.01.2024" },
            { abbr: "AUIUI/AK9PT", name: "Pokročilé mobilní technologie", grade: "A", date: "09.01.2024" },
            { abbr: "AUIUI/AK9PT", name: "Pokročilé mobilní technologie", grade: "A", date: "09.01.2024" }
          ])
          .set({
              cellPadding: "0.3em",
              cellAlign: "center",
              style: {
                  font: "Arial"
              },
              headStyle: {
                  color: "white",
                  background: "#ff6d22"
              },
              border: "2px solid black",
              center: true,
              borderRadius: 2.2,
              stroke: this.filtero("blast", el.id, obj.customOptions),
              // Invalid token
              gradient: this.filtero("gradient", el.id, obj.customOptions),
              animation: this.filtero("animation", el.id, obj.customOptions),
              shadow: this.filtero("shadow", el.id, obj.customOptions),
              span: this.filtero("span", el.id, obj.customOptions),
              backgroundOp: this.filtero("background", el.id, obj.customOptions),
              marginOp: this.filtero("margin", el.id, obj.customOptions),
              transform: this.filtero("transform", el.id, obj.customOptions),
              filtera: this.filtero("filter", el.id, obj.customOptions),
          });


   // .render("#mount"); 
 
    }



    static mapRow(obj){

        let el = obj.el;
        console.log("///");
        console.log(el);


       // return new Text("Hello").set({size: "S3"});

        return new FlexRow().set({
                         stroke: this.filtero("blast", el.id, obj.customOptions),
                         gradient: this.filtero("gradient", el.id, obj.customOptions),
                         animation: this.filtero("animation", el.id, obj.customOptions),
                         shadow: this.filtero("shadow", el.id, obj.customOptions),
                         span: this.filtero("span", el.id, obj.customOptions),
                         backgroundOp: this.filtero("background", el.id, obj.customOptions),
                         marginOp: this.filtero("margin", el.id, obj.customOptions),
                         transform: this.filtero("transform", el.id, obj.customOptions),
                         filtera: this.filtero("filter", el.id, obj.customOptions),
        }).items([

new Text("This").set({
    size: "S3"
}), 

new Text("is").set({
    size: "S3",
    text: "Hello"
}), 

new Text("row.").set({
    size: "S3",
    text: "Hello"
})
    
])
        

    }


    static mapCode(obj){

        let el = obj.el;
        
        return new Code()
                    .set({
                         stroke: this.filtero("blast", el.id, obj.customOptions),
                         gradient: this.filtero("gradient", el.id, obj.customOptions),
                         animation: this.filtero("animation", el.id, obj.customOptions),
                         shadow: this.filtero("shadow", el.id, obj.customOptions),
                         span: this.filtero("span", el.id, obj.customOptions),
                         backgroundOp: this.filtero("background", el.id, obj.customOptions),
                         marginOp: this.filtero("margin", el.id, obj.customOptions),
                         transform: this.filtero("transform", el.id, obj.customOptions),
                         filtera: this.filtero("filter", el.id, obj.customOptions),
                        pad: [
                            { l: 30 },
                        ], 
                        mar: [
                            { a: 30 },
                        ], 
                        class: "language-js",
                        code: 'new Text("Modality").set({ font: "Arial" })'
                    })
        

    }

  static mapCopy(obj) {
  const customOptions = obj.customOptions;
  const ft = customOptions.filter(l => l.op === "copy")[0];
  const count = ft?.count ?? 3;

  const minSize = 300;           // size of whole wheel
  const cardSize = 30;           // width/height of text wrapper
  const padding = 30;            // empty ring inside wheel
  const wheelRadius = minSize / 2 - padding;
  const ringRadius = wheelRadius - cardSize / 2;

  let animation = `
animation: {
        op: {
            name: "animation",
            color: "green",
            width: "1px",
            fireAt: "inview",
            keyframesOpen: [
                {
                    transform: "rotate(360deg)",
                    opacity: 0
                },
                {
                    transform: "rotate(0deg)",
                    opacity: 1
                }
            ],
            keyframesClose: [
                {
                    transform: "rotate(0deg)",
                    opacity: 1
                },
                {
                    transform: "rotate(0deg)",
                    opacity: 0
                }
            ],
            openOptions: {
                duration: 300,
                fill: "forwards",
                delay: 1000
            },
            closeOptions: {
                duration: 1,
                fill: "forwards",
                delay: 1000
            }
        },
        target: [
            "#first"
        ]
    },
  `;

  return `new Wrapper()
.set({
  width: "${minSize}px",
  height: "${minSize}px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "absolute",
  id: "#first",
  scale: 0.3,
  ${ft?.animation ? animation : ""}
})
.add(
  Array.from({ length: ${count} }).map((_, i) => {

    const bbox = {width: "${minSize}px", height: "${minSize}px"};

      const elHeight = bbox.height;

      const cx = ${minSize / 2};
      const cy = ${minSize / 2};

      const R = ${minSize/2};

      const n = ${count};

      // Evenly spaced angles, starting at top (-90°)
      const angle = (i / n) * Math.PI * 2 - Math.PI/2;
      const dist = R + parseFloat(elHeight)/2;

      const x = cx + dist * Math.cos(angle);
      const y = cy + dist * Math.sin(angle);

      let rot = angle * 180 / Math.PI + 90;
      rot = (rot % 360 + 360) % 360;
      rot = (rot % 360 + 360) % 360;

      return  new Text("Hello").set({
              size: "S1",
              color: "green",
              font: "Arial",
               left: \`\${x}px\`,
                top: \`\${y}px\`,
                transform: {
          op: {
            name: "transform",
            transform: {
              static: true,
              keep: true,
              values: [
                "tx:-50%",
                "ty:-50%",
                \`rotate(\${rot}deg)\`
              ]
            }
          }
        }
    })

   
  })
)`;
}


    static mapCopya(){

        
          return `\n
        new Wrapper()
    .set({
      width: "600px",
      height: "300px",
      justifyContent: "center",
      alignItems: "center",
      display: "flex",
      position: "relative",
    })
    .add(
      Array.from({ length: 3 }).map((_, i) => {
        const angle = i * 120;
        return new Text("Hello")
          .set({
            size: "S1",
            color: "green",
            position: "absolute",
            transform: {
              op: {
                name: "transform",
                transform: {
                  static: true,
                  keep: true,
                  hardCSS: \`translate(-50%, -50%) rotate(\${angle}deg) translate(${radius}px) rotate(\${-angle}deg)\`
                  values: [
                    \`translate(-50%, -50%) rotate(\${angle}deg) translate(120px) rotate(\${-angle}deg)\`,
                  ],
                }
              }
            }
          });
      })
    )
          `;
    }

    static button(){
       return new Button("Submit")
        .set({
            fluidc: "S6",
            color: "white",
            background: "#1abc9c",
            arrpad: {sides: ["all"], value: ".3rem"},
            radius: ".3rem",
            onTap: () => {alert("Nice")},
            keySet: {key: "border", value: "3px solid green"}
        });
    }

    static multiswitcher(){
      

        let r = new Switcher()
        .set({breakpoints:[
              { at: "0px", view: new Text("First").set({}) }, 
      
              { at: "700px", view: new Text("Nice").set({}) }, 
       
              { at: "800px", view: new Text("Best").set({}) }, 
      ]}); // undefined must be passed to render method

     // console.log("ROD");
    //  console.log(r.toCode().join(""));

     // return new Text("MS").set({});

     return r;
    }


    static video(){
        return new Video("https://www.w3schools.com/html/mov_bbb.mp4").set({});
    }

    static audio(){
        return new Audio("rouska.mp3").set({background: "#1abc9c"});
    }

    static radio(obj){
      //  alert("PP")
        return new RadioGroup()
        .set({
            items: ["Male", "Female", "Third shit"],
            multiple: true // wrnóng
        });
    }

    static input(obj){
        //  alert("PP")
          return new TextField().set({
            type: "text",
            placeholder: "Enter swimming time",
            arrayMargin: {sides: ["all"], value: "1rem"}
           });
      }

      static floatInput(obj){
        //  alert("PP")
          return new FloatingInput()
          .set({
                  title: "Your name",
                  type: "input"
              });
      }

      static filePicker(obj){
        //  alert("PP")
          return new FilePickera()
          .set({
              id: "A",
              title: "Add profile picture",
              background: "#3498DB",
              color: "white",
              font: "Arial",
              radius: "3rem",
              accept: "application/pdf"
          });
      }

      static picker(obj){

        let items = [["none", "select a car---"], ["tesla", "Tesla"], ["audi", "Audi"]];
   
        
          return new Picker()
          .set({
              items: items,
              font: "Arial",
              arrayPadding: ({sides: ["all"], value: "0.5rem"}),
              rounded: true
          })
      }

   


    static dropdown(obj){
        if (!obj.el.items){
            obj.el.items = ["Flower", "Car", "Maseratti"];
        }

        let items = obj.el.items.map(el =>  new Link().set({
          pad: [{
              a: 10
          }],
          font: "Arial",
          bold: true,
          link: "https://www.apple.com",
          text: el,
          icon: {padding: 30, url: "https://cdn-icons-png.flaticon.com/512/32/32339.png"},
          hover: {
			color: "wheat",
			animation: 0.3
		},
       
        }));

        return new Dropdown()
        .set({ 
          behaviour: "click", // click otherwise
          //width: "120px",
        
         // socenter: true,
         // background: "green",
         //  padding: "30px", 
         pad: [{"a": "1rem"}],
         mar: [{"a": "1rem"}],
           border: "1px solid black",
            width: "180px",
           radius: "1rem"
         })
        .add([
          /*new Text("Click me"),
          new Text("Option 1"),
          new Text("Option 2"),
          new Text("Option 3"),*/
      
          
          new Text(obj.el.items[0]).set({
            font: "Arial",
            fluidc: "S6",
          weight: "bold",
          align: "center",
          cursor: "hand",
          icon: {
            padding: 30,
            url: "https://cdn-icons-png.flaticon.com/512/60/60995.png"
            },
          pad: [{l: 10, r: 10}],
       
          }),
      
          new Wrapper().set({border: "1px solid green", background: "#1abc9c", radius: "0.7rem", socenter: true})
          .add(items.slice(1)
        
         /* new Text("Option 1o").set({font: "Arial",  pad: [{a: 10}],}),
          new Text("Option 2").set({font: "Arial",  pad: [{a: 10}],}),
          new Text("Option 3").set({font: "Arial",  pad: [{a: 10}],}),
        */
        )
        ])
    }

  /*  static row(obj){
        const customOptions = obj.customOptions;
alert("PP")
      let ret =  new FlexRow()
      .set({
          borderObj: {
              width: "3px",
              color: "orange"
          },
       colat: "600px"
      })
      .items([
  
          new Text("Firsta").set({
               border: "3px solid green",
               width: "100%"
          }),
  
          new Text("Second").set({
              border: "3px solid green", 
              width: "100%"
          }),
  
          new Text("Third").set({
              border: "3px solid green",
              width: "100%"
          })
  ])


  return ret;
       
    }*/

    static protoNav(obj){

        const customOptions = obj.customOptions;

       // console.log("ONA");
       // console.log(obj);
        // get slayout now
      //  let ft = customOptions.filter(l => l.op.name === "navStyle")[0].op;
       // console.log("HOHJM");
       // console.log(ft);


        let items = [
            {title: "Fire", link: "@e"},
            {title: "and", link: "@e"},
            {title: "smoke", link: "@e"}
        ];

        let links = items.map((i, o) => new Link(`"${i.title}"`)
        .set({
            fluidc: "S6",
            text: i.title,
            link: i.link,

            font: "Arial",
           // pad: [{a:20}],
            pad: [{ "a": 40 }],
            bold: true,
            hover: { color: "wheat", animation: 0.3 },

          
        }));


        let animatedLinks = items.map((i, o) => new Link(`"${i.title}"`)
        .set({
            fluidc: "S6",
            text: i.title,
            link: i.link,

            font: "Arial",
           // pad: [{a:20}],
            pad: [{ "a": 40 }],
            bold: true,
            hover: { color: "wheat", animation: 0.3 },

           animation: { // also works without animation block
                range: ["0px", "1900px"],
                op: {
                    name: "animation",
                    color: "green", // 102410 19/11/24 staggered
                    width: "1px",
                    keyframesOpen: [ // staggered effect 
                        { transform: `translate(100%, ${o*10}%)`, opacity: 0 },
                        { transform: `translate(0%)`, opacity: 1  }
                    ], 
                    keyframesClose: [ // put where approprriate
                        { transform: 'translate(0%)', opacity: 1 },
                         { transform: `translate(100%, ${o*10}%)`, opacity: 0 }
                    ], 
                    openOptions: {
                        duration: 300,
                        fill: 'forwards',
                        delay: 1000 // 1000
                    },
                    closeOptions:{
                        duration: 1, // 1 should be acceptable here when I close
                        fill: 'forwards',
                        delay: 1000 // 1000 why does 3000 work during open but not during close??
                    },
                },
            },
        }));


if (obj.el.dropdown){


        const dropdown = new Dropdown().set({
            behaviour: "mouseover",
      pad: [{"a":40}],
      // socenter: true,
      padding: "10px",
      border: "1px solid black"
          }).add([
     new Text("First")
     .set({
     cursor: "hand",
     icon: {padding:30,url:"https://cdn-icons-png.flaticon.com/512/60/60995.png"},
     fluidc: "S6",
     pad: [{l:20,r:10}], 
     font: "Arial",
     align: "center",
     weight: "bold", 
     
     })
     
    ,
     new Wrapper() 
    .set({centerColumn: true,
     radius: "0.7rem",background: "#1abc9c",
     makeResponsiveBehaviour: "undefined",})
    .add([ 
    
     new Link()
     .set({
     pad: [{a:10}],
     font: "Arial",
     hover: {color:"wheat",animation:0.3},
     bold: true,
     link: "https://www.apple.com",
     text: "Second",
     icon: {padding:30,url:"https://cdn-icons-png.flaticon.com/512/32/32339.png"},}) 
    ,
     new Link()
     .set({
     pad: [{a:10}],
     font: "Arial",
     hover: {color:"wheat",animation:0.3},
     bold: true,
     link: "https://www.apple.com",
     text: "Third",
     icon: {padding:30,url:"https://cdn-icons-png.flaticon.com/512/32/32339.png"},}) 
    ])]);

    animatedLinks.push(dropdown);
    links.push(dropdown);
}

    
       


      


    //console.log("ANA");
    //console.log(animatedLinks);


    /*    const removeKeyFromArray = (arr, keyToRemove)  => {
            return arr.map(obj => {
              const { [keyToRemove]: _, ...rest } = obj;
              return rest;
            });
          }

         const updatedLinks = removeKeyFromArray(links, "");
          console.log(updatedLinks);
          */

          let shouldAnim = obj.el.animation;

      /*  let rt = new UINavBar()
        .setup({
            animate: true,
            radius: "1rem",
            background: "#1abc9c",
            hamColour: {opened: "#1abc9c", closed: "white"},
            mobileSize: "1.2em"
        }).items(shouldAnim ? animatedLinks : links);

*/

     //   console.log("PPPP");
    //    console.log(rt.toCode());
       // return rt;



       return new Switcher()
           .set({
               breakpoints: [ // 172800 almost
                   {
                       at: "0px", view: new MobileBar().set({
                           background: "#ecf0f1", 
                           mar: [{ "a": 21 }],
                           brand: new Text("Company").set({size: "S6", font: "Helvetica"}),
                          hamburgerColour: "#3498db",
                          radius: "1rem",
                       }).add([

                       new Link().set({text: "About", url: "#a"}),//.render()
                     


                       new Dropdown()
                       .set({
                        behaviour: "mouseover",
                        pad: [{ "a": 40 }],
                        mar: [{ "lr": "auto" }],
                        breakpoint: "1200px",
                        // socenter: true,
                        padding: "10px",
                        border: "1px solid black",
                      //  background: "orange",
                        height: "auto",
                   
                    }).add([
                        new Text("More")
                            .set({
                                cursor: "hand",
                                icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                fluidc: "S6",
                                pad: [{ l: 10, r: 10 }],
                                font: "Arial",
                                align: "center",
                                weight: "bold",

                            }),

                            new Text("Our story")
                            .set({
                                cursor: "hand",
                               // icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                fluidc: "S6",
                                pad: [{ l: 10, r: 10 }],
                                font: "Arial",
                                align: "center",
                                weight: "bold",

                            }),

                            new Text("Team")
                            .set({
                                cursor: "hand",
                               // icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                fluidc: "S6",
                                pad: [{ l: 10, r: 10 }],
                                font: "Arial",
                                align: "center",
                                weight: "bold"
                            })
                         
                         ]),




                       new Link("B").set({text: "About", url: "#b"}),//.render()
                       new Link("C").set({text: "Contact", url: "https://www.abcnews.com"})//.render()
                       ])//.addNavItem(new Link("C").set({}).render())
                   },
   
                   {
                       at: "1200px", view: new DesktopBar().set({
                           background: "#ecf0f1",
                           mar: [{ "a": 21 }],
                           maxHeight: "100px",
                           radius: "1rem"
                           
                         //  brand: new Text("A").set({}).render()
                       })
                     //  .setBrand(new Text("A").set({}).render())
                       .add([
                        new Text("Company").set({size: "S6", font: "Helvetica"}),
                        new Spacer(true),

                       // new Link("O").set({text: "O", url: "#a"}),
                        

// 161311 vnuk 

                           new Dropdown().set({
                               behaviour: "mouseover",
                               pad: [{ "a": 40 }],
                               // socenter: true,
                               padding: "10px",
                               border: "1px solid black",
                               radius: "30px",
                                width: "130px"
                           }).add([
                               new Text("More")
                                   .set({
                                       cursor: "hand",
                                       icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                       fluidc: "S6",
                                       pad: [{ l: 10, r: 10 }],
                                       font: "Arial",
                                       align: "center",
                                       weight: "bold",

                                   }),


new Wrapper().set({
    flexDir: "column", 
   // background: "orange", 
    mar: [{"t": "10px"}],
    radius: ".3rem"}).add([



                                   new Link("")
                                   .set({
                                    text: "Who we are", // BEWARE
                                    url: "jk",
                                       cursor: "hand",
                                      // icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                       fluidc: "S6",
                                       pad: [{ l: 10, r: 10 }],
                                       font: "Arial",
                                       align: "center",
                                       weight: "bold"
                                   }),

                                   new Link("")
                                   .set({
                                    text: "Info", 
                                    url: "#u",
                                       cursor: "hand",
                                      // icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                       fluidc: "S6",
                                       pad: [{ l: 10, r: 10 }],
                                       font: "Arial",
                                       align: "center",
                                       weight: "bold",
       
                                   }),

                                   new Link("")
                                   .set({
                                    text: "About", 
                                    url: "#u",
                                       cursor: "hand",
                                      // icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                                       fluidc: "S6",
                                       pad: [{ l: 10, r: 10 }],
                                       font: "Arial",
                                       align: "center",
                                       weight: "bold",
       
                                   }),
                                ])



                                  
                                
                                ]),











                       new Link().set({ text: "About", url: "#a"}),//.render()
                       new Link().set({ text: "Services", url: "#a"}),//.render()
                       new Link().set({ text: "Contact", url: "#a"})//.render()
                    //   new Link("C").set({})//.render()
                       ])
                           /*.addNavItem(
                               new Link("C").set({}).render()
                           )*/
   
   },
        // { at: "800px", view: new Link("C").set({}) },
       //  { at: "700px", view: Object.assign(document.createElement("h1"), { textContent: "Medium View" }) },
       //  { at: "800px", view: Object.assign(document.createElement("h1"), { textContent: "Large View" }) },
       ],
     })

       // return new Text("A").set({})
    }
     
    


    static sideNav(obj){

        const customOptions = obj.customOptions;

        // get slayout now
        let ft =[];// customOptions.filter(l => l.op.name === "navStyle")[0].op;
     //  let arr = [];
       // console.log("HOHJM");
       // console.log(ft);






        let items = [
            {title: "Home", link: "@e"},
            {title: "Projects", link: "@e"},
            {title: "Services", link: "@e"}
        ];


          /* child.animate([
                            { transform: 'translateY(0%)', opacity: 1 },
                            { transform: 'translateY(100%)', opacity: 0 }
                        ],
                            {
                                duration: 1,
                                fill: 'forwards',
                                delay: 1000
                            });*/

        const links = items.map((i, o) => new Link(`"${i.title}"`)
        .set({
            fluidc: "S4",
            text: i.title,
            link: i.link,
            isNavA: true,
            url: "#e",
            id: "#" + i.title.toLowerCase(),
            font: "Arial",
            pad: [{a:20}], 
            bold: true,
             tags: {open: "sidebar:open", close: "sidebar:closed"},
            align: "left", // 21:04:58
             hover: { 
	            color: "wheat", 
	            animation: 0.3 
            }
        }));


        const dropdown = new Dropdown().set({
            behaviour: "mouseover",
            pad: [{ "a": 40 }],
            //socenter: true,
            padding: "10px",
          //  border: "1px solid black",
            animation: { // also works without animation block
                range: ["0px", "1900px"],
                op: {
                    name: "animation",
                    color: "green", // 102410 19/11/24 staggered
                    width: "1px",
                    keyframesOpen: [ // staggered effect 
                        { transform: `translate(100%, ${1 * 10}%)`, opacity: 0 },
                        { transform: `translate(0%)`, opacity: 1 }
                    ],
                    keyframesClose: [ // put where approprriate
                        { transform: 'translate(0%)', opacity: 1 },
                        { transform: `translate(100%, ${1 * 10}%)`, opacity: 0 }
                    ],
                    openOptions: {
                        duration: 300,
                        fill: 'forwards',
                        delay: 1000 // 1000
                    },
                    closeOptions: {
                        duration: 1, // 1 should be acceptable here when I close
                        fill: 'forwards',
                        delay: 1000 // 1000 why does 3000 work during open but not during close??
                    },
                },
            },
        }).add([
            new Text("More")
                .set({
                    cursor: "hand",
                    icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/60/60995.png" },
                    fluidc: "S6",
                    pad: [{ l: 10, r: 10 }],
                    font: "Arial",
                    align: "center",
                    weight: "bold",

                })

            ,
            new Wrapper()
                .set({
                    centerColumn: true,
                    radius: "0.7rem", background: "#1abc9c",
                    makeResponsiveBehaviour: "undefined",
                })
                .add([

                    new Link()
                        .set({
                            pad: [{ a: 10 }],
                            font: "Arial",
                            hover: { color: "wheat", animation: 0.3 },
                            bold: true,
                            link: "https://www.apple.com",
                            text: "Second",
                            icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/32/32339.png" },
                        })
                    ,
                    new Link()
                        .set({
                            pad: [{ a: 10 }],
                            font: "Arial",
                            hover: { color: "wheat", animation: 0.3 },
                            bold: true,
                            link: "https://www.apple.com",
                            text: "Third",
                            icon: { padding: 30, url: "https://cdn-icons-png.flaticon.com/512/32/32339.png" },
                        })
                ])]);


       


        let animatedLinks = items.map((i, o) => new Link(`"${i.title}"`)
        .set({
            fluidc: "S4",
            text: i.title,
            link: i.link,
            isNavA: true,
            url: "#myURL",
            id: "#" + i.title.toLowerCase(),
            font: "Arial",
            pad: [{a:20}], 
            bold: true,
             tags: {open: "sidebar:open", close: "sidebar:closed"},
            align: "left", // 21:04:58
            hover: { 
	            color: "wheat", 
	            animation: 0.3 
            },
            animation: { // also works without animation block
                range: ["0px", "1900px"],
                op: {
                    name: "animation",
                    color: "green", // 102410 19/11/24 staggered
                    width: "1px",
                    keyframesOpen: [ // staggered effect 
                        { transform: `translate(100%, ${o*10}%)`, opacity: 0 },
                        { transform: `translate(0%)`, opacity: 1  }
                    ], 
                    keyframesClose: [ // put where approprriate
                        { transform: 'translate(0%)', opacity: 1 },
                        { transform: `translate(100%, ${o*10}%)`, opacity: 0 }
                    ], 
                    openOptions: {
                        duration: 300,
                        fill: 'forwards',
                        delay: 1000 // 1000
                    },
                    closeOptions:{
                        duration: 1, // 1 should be acceptable here when I close
                        fill: 'forwards',
                        delay: 1000 // 1000 why does 3000 work during open but not during close??
                    },
                },
            },
        }));

//console.log("OBJ EL DROPDOWN");
//console.log(obj);

if (obj.el.dropdown){
    animatedLinks.push(dropdown);
    links.push(dropdown);
}

        // Always require link wrapper
        const linkWrapper = new Wrapper().set({column: true}).add([
            new Text("Sidebar")
             .set({   
                   size: "S6",
                   font: "Arial",
                   id: "#olod",
                   italic: true,
                   animation: {range:["0px","1900px"],op:{name:"animation",color:"green",width:"1px"}},
                   pad: [{l:20}, {t:20}], // Insert in the right plce
                 //  pad: {sides: ["all"], value: "1rem"}
                }),

            obj.el.animation ? animatedLinks[0] : links[0],
            obj.el.animation ? animatedLinks[1] : links[1],
            obj.el.animation ? animatedLinks[2] : links[2],
            (obj.el.animation && obj.el.dropdown) ? animatedLinks[3] : new Text("").set({}).excludeFromCode(),

            new Text("Company, 2025")
            .set({ // no ID, no animation
                pad: [{a: 20}],
                animation: {range:["0px","1900px"],op:{name:"animation",color:"green",width:"1px"}},
            })
        ]);

        const offCanvas = new Wrapper().set({column: true}).add([
            new Text("Off canvas")
             .set({   
                   fluidc: "S6",
                   font: "Arial",
                   id: "#olod",
                   italic: true,
                   animation: obj.el.animation ? {range:["0px","1900px"],op:{name:"animation",color:"green",width:"1px"}} : null,
                   pad: [{l:40}, {t:20}], // Insert in the right plce
                 //  pad: {sides: ["all"], value: "1rem"}
                }),

               // obj.el.animation ? animatedLinks[0] : links[0],
        ])


        // Show more than links in sideNav...
        // Supply entire view with links instead of just links
        // https://www.rabenrifaie.com/

   
        
        let rt = new SideNav()
        .setup({
            animate: true, // 193608 works
            radius: "1rem",
            isSide: true,
            background: "#ecf0f1",
            hamColour: {opened: "#1abc9c", closed: "#e67e22"},
            mobileSize: "1.2em",
            fixed: true,
            tags: {open: "sidebar:open", close: "sidebar:closed"}
        }).items(obj.el.offcanvas ? offCanvas : linkWrapper );



       // console.log("PPPP");
      //  console.log(obj.el.offcanvas);
      // console.log(rt.toCode());
        return rt;

       // return new Text("A").set({})
    }

    static mapFree(obj){
                const customOptions = obj.customOptions;

                // get slayout now
                let ft = customOptions.filter(l => (l.op.name === "slayout" || l.op.name === "layout"))[0];
                let spanObjects = null;
                let templateCols = {cols: 6, rows: 6};

              //  console.log("FT----");
              //  console.log(ft.op.value)

                if (ft.op.value === "text-above-image" || ft.op.value === "image-above-text"){
                    spanObjects = null;
                    templateCols = null;
                }
5
                if (ft.op.value === "img-overlay-text"){ // 17:43:03
                    spanObjects = {
                        text: {row: "1 / span 2", col: "3 / span 2"},
                        image: {row: "2 / span 3", col: "3 / 3"}
                    }
                }

                // react on by value to control amount
                if (ft.op.value === "img-leftof-text") { // no 3-6
                    spanObjects = {
                        text: {row: "1", col: "1 / 3"},
                        image: {row: "1", col: "3 / 4"}
                    }
                }

               /* if (ft.op.value === "text-center-img" || ft.op.value === "img-center-text")  { // no 3-6
                       spanObjects = {
                           text: {row: "1", col: "1"},
                           image: {row: "1", col: "1"}
                       }
                   }*/

                // probably dont use obj.el.els here, bit can access
                 let ela = new Free()
                 .set({id: "#3", templateCols: templateCols,  height: "600px", })
                 .add([
                    new Text("I am free")
                        .set({ 
                             border: "3px solid green",
                             font: "Arial", // 23:11:24 08/11/24 "font" works also?
                             size: "S1",
                             color: "#1abc9c",
                             gpos: spanObjects != null ? (spanObjects.text) : null, // "span 2" can also work here as string 
                             zIndex: 1
                            }),

                    new Image()
                      .set({
                        url: "https://upload.wikimedia.org/wikipedia/commons/a/ac/MSC_World_Europa_-_Saint-Nazaire_-_June_2022.jpg",
                        // url: "https://www.cruisemapper.com/images/ships/2183-e9681865a61.jpg", 
                         width: "400px",
                         height: "auto",
                         gpos:  spanObjects != null ? (spanObjects.image) : null,
                         //zIndex: -3
                        })
                ]);

                return ela;
               // console.log("ETC");
               // console.log(ela.toCode());
    }

    static mapCircle(obj){

  let el = obj.el;

return new Circle()
  .set({
    diameter: 108,
    background: "#1abc9c", 
          stroke: this.filtero("blast", el.id, obj.customOptions),
                gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                span: this.filtero("span", el.id, obj.customOptions),
                backgroundOp: this.filtero("background", el.id, obj.customOptions),
                marginOp: this.filtero("margin", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
   })
 }



    static mapPolygon(obj){

  let el = obj.el;

   
  const count = obj.el.sides ?? 7;

let elo = new Polygon({ id: "hex" })
  .set({
    sides: count,
    size: 300,
    background: "#1abc9c",
     //  blast: this.filtero("blast", el.id, obj.customOptions), not supported
   gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                span: this.filtero("span", el.id, obj.customOptions),
                backgroundOp: this.filtero("background", el.id, obj.customOptions),
                marginOp: this.filtero("margin", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
  })

  console.log(elo.code);

  console.log(elo.toCode);

  return elo;
 }


    static mapText(obj) {
      //  console.log(obj.el.type);

        let el = obj.el;

    

console.warn("WHY DIFFER ATA TEXT (grad)");
console.log(obj.customOptions);


        return new Text(el.text || el.value)
            .set({
                id: el.id,
                class: el.class,
                color: el.color,
                size: this.getElType(el.type), // update 23/07/2025
                font: el.font ?? "Arial",
               // index: obj.i + "",
               // keySet: {key: "border", value: "3px solid green"},
                stroke: this.filtero("blast", el.id, obj.customOptions),
                gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                span: this.filtero("span", el.id, obj.customOptions),
                backgroundOp: this.filtero("background", el.id, obj.customOptions),
                marginOp: this.filtero("margin", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
                resprop: el.resprop ? [
	{ breakpoint: "1400px", background: "orange", width: "200px", height: "200px" },
	{ breakpoint: "900px", background: "green", height: "100px", width: "100px" }
] : null//this.filtero("resprop", el.id, obj.customOptions),
             //   copy: this.filtero("copy", el.id, obj.customOptions),
            });
    }


    static mapImage(obj){
        let el = obj.el;

        return new Image(el.url)
        .set({
            ...el,
            isFull:el.isFull,
         //   index: obj.i + "",
            animation: this.filtero("animation", el.id, obj.customOptions),
            shadow: this.filtero("shadow", el.id, obj.customOptions),//customOptions.filter(l => l.op.name === "shadow")[0],
            marginOp: this.filtero("margin", el.id, obj.customOptions),//customOptions.filter(l => l.op.name === "margin")[0],
            filtera: this.filtero("filter", el.id, obj.customOptions),//customOptions.filter(l => l.op.name === "filter")[0]
      // zIndex: -1
        });
    }

    static mapLink(obj){
        let bst = obj.customOptions.filter(l => l.op.name === "link-style");//[0];

        let ela = null;


      //  console.log("Link object");
     //   console.log(obj);

                let re = obj.el;
                if (obj.el.id) {
                    re["id"] = obj.el.id;
                }


             //   re["url"] = "https://www.nasa.gov";

                if (obj.el.link && obj.el.text){
                    re["url"] = obj.el.link;
                    re["text"] = obj.el.text;
                }

               
                // KEEP COMMENTED OUT
               // re["keySet"] = {key: "background", value: "shadow: 3px 3px solid green"};

                // 10:42:18 Nice!!! 24/11/24
                    re["animation"] = this.filtero("animation", obj.el.id, obj.customOptions),
                    re["class"] = obj.el.class,
                    re["width"] = obj.el.width,


                   

                    re["font"] = "Arial";
                    re["fluidc"] = obj.el.fluidc;
                  //  re["index"] = obj.i + "", // add other options here

                    //  transform: this.filtero("transform", el.id, obj.customOptions),
                     re["transform"] = this.filtero("transform", obj.el.id, obj.customOptions),
                    re["shadow"] = this.filtero("shadow", obj.el.id, obj.customOptions),//customOptions.filter(l => l.op.name === "shadow")[0],
                    re["gradient"] = this.filtero("gradient", obj.el.id, obj.customOptions),
                      re["blast"] = this.filtero("blast", obj.el.id, obj.customOptions),
                    re["backgroundOp"] = this.filtero("background", obj.el.id, obj.customOptions),//customOptions.filter(l => l.op.name === "background")[0];
                    re["pad"] = [{ "a": 10 }];

                if (bst.length > 0) {
                        ela = LinkStyler.style({
                         el: obj.el,
                         re: re,
                         bst: bst,
                         options: obj.customOptions
                    })[bst.length - 1]; // zero idea how this works but okay 00:30:32 09/05/24

                } else {
                    ela = new Link().set(re);
                }

               /* if (ela != undefined) {
                    this.code.push(ela.toCode().join(""));
                    this.ready2Render.push(ela);
                    this.css.push(ela.toCSS());
                    this.elCSS.push(ela.toElCSS());
                    this.elHTML.push(ela.toHTMLA());
                    ela = ela.render();
                }*/


                    return ela;
    }


    static mapGrid(obj){
        console.log("OBJ IS");
    console.log(obj.storage);
 let el = obj.el;
     let cardOption = obj.customOptions.find(l => l.op.name === "card-style") ?? {};

       const gradient = this.filtero("gradient", el.id, obj.customOptions);
const animation = this.filtero("animation", el.id, obj.customOptions);
const shadow   = this.filtero("shadow", el.id, obj.customOptions);
const marginOp = this.filtero("margin", el.id, obj.customOptions);
const filtera  = this.filtero("filter", el.id, obj.customOptions);
const blast    = this.filtero("blast", el.id, obj.customOptions);




    // base card block (string template)
    const baseCard = `
        new Card()
            .set({
                width: "300px", 
                height: "700px",
                radius: "0.7rem",  
                mar: { sides: ["all"], value: "0.8rem" }
                 ${
        gradient !== undefined ? `,\n      gradient: ${JSON.stringify(gradient)}` : ""
      }${
        animation !== undefined ? `,\n      animation: ${JSON.stringify(animation)}` : ""
      }${
        shadow !== undefined ? `,\n      shadow: ${JSON.stringify(shadow)}` : ""
      }${
        marginOp !== undefined ? `,\n      marginOp: ${JSON.stringify(marginOp)}` : ""
      }${
        filtera !== undefined ? `,\n      filtera: ${JSON.stringify(filtera)}` : ""
      }${
        blast !== undefined ? `,\n      blast: ${JSON.stringify(blast)}` : ""
      }
            })
            .items([
                new Image(item.img).set({isFull: true, url: item.img}),
                new Text(item.title).set({ size: "S5", color: "orange" }),
                new Link("Link").set({
                    text: item.title, 
                    url: item.link, 
                    background: "#3498db", 
                    pad: [{ lr: "0.5rem", tb: "1rem" }], 
                    radius: "0.4rem", 
                    color: "white",
                    mar: [{"a": 21}]
                })
            ])`;

    // zoom card block (string template)
    const zoomCard = `
        new ZoomCard()
            .set({
                url: item.img, 
                font: "Arial", 
                mar: { sides: ["all"], value: "0.8rem" }, 
                inpad: "1rem", 
                useBrightness: true
            })
            .items([
                new Text(item.title).set({ fluidc: "S6", color: "orange" }),
                new Link("Link").set({
                    text: item.title, 
                    url: item.link, 
                    background: "#3498db", 
                    pad: [{ lr: "0.5rem", tb: "1rem" }], 
                    radius: "0.4rem", 
                    color: "white"
                })
            ])`;

    // pick card type depending on obj.el.backgroundCard
    const cardTemplate = obj.el.backgroundCard ? zoomCard : baseCard;

  


    return ` new FlexGrid()
    .set({
      colat: "700px",
      wrap: true,
      align: "center",
      gap: "1rem"
       ${
        gradient !== undefined ? `,\n      gradient: ${JSON.stringify(gradient)}` : ""
      }${
        animation !== undefined ? `,\n      animation: ${JSON.stringify(animation)}` : ""
      }${
        shadow !== undefined ? `,\n      shadow: ${JSON.stringify(shadow)}` : ""
      }${
        marginOp !== undefined ? `,\n      marginOp: ${JSON.stringify(marginOp)}` : ""
      }${
        filtera !== undefined ? `,\n      filtera: ${JSON.stringify(filtera)}` : ""
      }${
        blast !== undefined ? `,\n      blast: ${JSON.stringify(blast)}` : ""
      }
    })
    .items(
      [
        { img: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Starship_S20.jpg", title: "Starship", link: "#ship" },
        { img: "https://upload.wikimedia.org/wikipedia/commons/1/16/Apollo_11_Launch_-_GPN-2000-000630.jpg", title: "Saturn V", link: "#saturn" },
        { img: "https://upload.wikimedia.org/wikipedia/commons/d/d6/STS120LaunchHiRes-edit1.jpg", title: "Shuttle", link: "#shuttle" }
      ].map(item => 
        ${cardTemplate}
      )
    )
    `;
    }


    static mapCDiv(obj){

        let customOptions = obj.customOptions;

      
      
        if (rta) {

            let re = el;
            re["makeResponsiveBehaviour"] = rta.op.hash[0].l;
            re["index"] = i;

            let childRe = {};
            childRe["width"] = "200px";
            childRe["height"] = "100px";

            ela = new Wrapper().set(re)
            if (rta.op.hash[0].child) {

                childRe["makeResponsiveBehaviour"] = rta.op.hash[0].child.l;

                let child = new Wrapper().set(childRe).add([
                    new Text("Hello")
                ]);

                ela = new Wrapper().set(re).add([child]);
            }
    }
}

static checkbox(obj){
    return new Checkbox().set({
    name: "acceptTerms",
    label: new Text("Check it out!").set({size: "S6", color: "#1abc9c", font: "Arial"}),
    mar: "10px",
   // size: "100px",
   // customStyle: true,
   // checkedBackgroundColor: "#1abc9c",
   // clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
});
  
}

static stack(obj){
    return new Stack()
    .set({})
       // .setup({})
        .add([
            new Image().set({url: "https://pbs.twimg.com/media/DwYvbCBVAAEKY_R.jpg"}),
          
         
     
            new Text("Samuel Suresh")
            .set({
                color: "#00ae56",
                font: "SF Pro Display",
                fluidc: "S2",
                pad: {sides: ["top", "left"], value: 20}
            }),
    ]);

}

static form(obj){ 

    // php -S localhost:8000
    // open http://localhost:8000/designertest/1-pagesample.html
   return new Form()
   .set({action:"file.php"}) // 12:45:53 Nice! 21/04/2025
   .add([
        new FloatingInput().set({
             title: "Your name",
             type: "input",
             name: "name"
        }),

        new FloatingInput().set({
            title: "Your email",
            type: "input",
            name: "email",
            color: "#3498db",
            font: "Arial",
            mar: [{"a": "1rem"}]
       }), 

       new RadioGroup()
        .set({
            name: "gender",
            items: ["Male", "Female", "Third shit"],
            multiple: false,
            tint: "#1abc9c",
            font: "Arial",
            exact: "3rem"
        }),

        new Picker()
          .set({
             name: "car",
              items: [
                ["none", "select a car---"],  // Placeholder option
                ["tesla", "Tesla"],          // Tesla as a selectable option
                ["audi", "Audi"]             // Audi as a selectable option
            ],
              font: "Arial",
              arrayPadding: ({sides: ["all"], value: "0.5rem"}),
              radius: "1rem",
              background: "#1abc9c"
          }),

         new FilePickera()
          .set({
              id: "A",
              name: "image",
              title: "Add profile picture",
              background: "#3498DB",
              color: "white",
              font: "Arial",
              radius: "3rem",
             // accept: "application/pdf"
          }),

        // datalist, range, filepicker, picker

       // add radio and read it in PHP

        new Button("Submit form").set({ // 174915 If I dont serve it, it downloads the php file
            type: "submit",
            background: "#3498db",
            color: "white",
            weight: "bold",
            radius: "1rem",
            pad: [{"a": "1rem"}], // add
            mar: [{"b": "1rem"}] // add
        })
    ]);
}

static simple(obj){
    // Chain the methods of the Simple class
return `new AreaSwitcher()
  .set({ gap: "10px", height: "700px" })
  .react([
    {
      at: "0", // Default size
      color: "red",
      template: [
        "aaaaaa",
        "bbbbbb",
        "cccccc",
        "dddddd",
        "eeeeee",
      ],
    },
    {
      at: "768", // Medium screen size
      color: "blue",
      template: [
        "aa bbb",
        "aa bbb",
        "cc ddd",
        "ee ddd",
      ],
    },
    {
      at: "1024", // Large screen size
      color: "green",
      template: [
        "aaa bbb",
        "ccc ddd",
        "eee ddd",
      ],
    },
  ])
  .add([
    new Text("Hello A").set({size: "S1"}),
    new Text("Hello B").set({size: "S1"}),
    new Text("Hello C").set({size: "S1"}),
    new Text("Hello D").set({size: "S1"}),
    new Text("Hello E").set({size: "S1"})
  ])`;


    // return new Simple().set({}).react([]);
}



    static mapWrap(obj) {
        let el = obj.el;

//console.log("GRQDOE"); // remove text flag from lin gradient when ding this on wrapper
//console.log(obj.customOptions);

        let kind = obj.el.kind ?? "";



        return new Wrapper(kind)
            .set({
                id: el.id,
                class: el.class,
                color: el.color,
                size: this.getElType(el.type), // update 23/07/2025
                font: el.font ?? "Arial",
                keySet: el.keySet,
               // keySet: {key: "border", value: "3px solid green"},
                stroke: this.filtero("blast", el.id, obj.customOptions),
                gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
            }).add([
                new Text("Hello").set({}),
                 new Text("Hello").set({}),
                  new Text("Hello").set({}),

            ]);
    }



    static mapUList(obj) {
        let el = obj.el;

//console.log("GRQDOE"); // remove text flag from lin gradient when ding this on wrapper
//console.log(obj.customOptions);

        let kind = obj.el.kind ?? "";



        return new UList(kind)
            .set({
                id: el.id,
                class: el.class,
                color: el.color,
                size: this.getElType(el.type), // update 23/07/2025
                font: el.font ?? "Arial",
                keySet: el.keySet,
               // keySet: {key: "border", value: "3px solid green"},
                stroke: this.filtero("blast", el.id, obj.customOptions),
                gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
            }).setItems([
               new Text("First").set({}),
               new Text("Second").set({}),
               new Text("Third").set({})
            ]);
    }


/*static base(){
    let res = class Appa extends Base {
        constructor(){
            super();
        }
        
        render(){
            return new Text("Q")
        }
    }

    return res;
}*/


    static getElType(type) {
        return `S${type.substr(1)}`;
    }

   static filtero(name, id, customOptions) {
       // console.warn(customOptions
          // .filter(l => l.op.name === name));
        let aro = customOptions
            .filter(l => l.op.name === name)
            .filter(l => {
                if (l.target) {
                    return l.target.includes(id)
                } else {
                    return true;
                }
            });

        return aro[0];
    }
}


export {ElementMapper};