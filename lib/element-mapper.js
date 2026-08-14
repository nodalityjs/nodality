/*!
 * nodality v1.0.223
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// CORE
import { Animator } from "../layout/animator.js";
import { RASTER_OP_NAMES } from "../lib/raster-ops.js";
import { didYouMean } from "../lib/suggest.js";
import { Base } from "../layout/base.js";
import { Text } from "../layout/text.js";
import { Image } from "../layout/image.js";
import { Link } from "../layout/link.js";
import { FlexRow } from "../layout/flex-row.js";
import { CustomDivRenderer } from "../layout/nav-factor/custom-div.js";
import { UINavBar } from "../layout/new-nav-bar.js";
import { SideBar } from "../layout/side-bar.js";
import { SideNav } from "../layout/side-nav-bar.js";
import { Free } from "../layout/free.js";
import { Audio } from "../layout/audio.js";
//import { Audionew } from "../layout/audionew.js";
import { Progress } from "../layout/progress.js";
import { Center } from "../layout/center.js";
import { Code } from "../layout/code.js";
import { Stack } from "../layout/stack.js";
import { Wrapper } from "../layout/container.js";
import { MetaAdder } from "../layout/meta-adder.js";
import { Table } from "../layout/table.js";
import { Dropdown } from "../layout/dropdown-2025.js";
import { Modal } from "../layout/modal-2025.js";
import { TextField } from "../layout/text-field.js";
import { Card } from "../layout/flex-card.js";
import { Wrap } from "../layout/wrap.js";
import { FlexGrid } from "../layout/flex-grid.js";
import { ZoomCard } from "../layout/zoom-card.js";
import { SimpleBar } from "../layout/simple-bar.js";
import { DesktopBar } from "../layout/beta-desktop-bar.js";
import { MobileBar } from "../layout/beta-mobile-bar.js";
import { Switcher } from "../layout/multiswitcher.js";
import { Spacer } from "../layout/spacer.js";
import { HScroller } from "../layout/horizontal-scroller.js";
import { Checkbox } from "../layout/checkbox.js";
import { Video } from "../layout/video.js";
import { UList } from "../layout/ulist.js";
import { Slider } from "../layout/slider-2025.js";

// FORM COMPONENTS
import { FloatingInput } from "../layout/form-components/floating-input.js";
import { Range } from "../layout/form-components/range.js";
import { RadioGroup } from "../layout/form-components/radio.js";
import { Picker } from "../layout/form-components/picker.js";
import { FilePickera } from "../layout/form-components/image-picker.js";
import { DataList } from "../layout/form-components/data-list.js";
import { Form } from "../layout/form-components/form.js";
import { Button } from "../layout/button.js";

// LIBRARY HELPERS / ANIMATIONS
// NOTE: no `import { Des }` here. It was unused and formed a circular import
// (designer -> element-mapper -> designer), which ES modules tolerate but which
// leaves one module partially initialised under some bundlers.
import { LinkStyler } from "../lib/link-getter.js";
import { CardGen } from "../lib/card-getter.js";
import { KeyframeAnim } from "../lib/keyframe-animation.js";
import { TransformAnim } from "../lib/transform-anim.js";
import { Stacker } from "../lib/stacker.js";
import { ScrollVideo } from "../lib/scroll-video.js";

// SHAPES / MISC
import { AreaSwitcher } from "../layout/grid-switcher.js";
import { Polygon } from "../layout/polygon.js";
import { Circle } from "../layout/circle.js";


// The closed set of `type:` values mapType understands, in the order it
// tests them. Kept beside the dispatch so a new branch without a new entry
// is visible in review — the vocabulary and the router should not drift.
const ELEMENT_TYPES = [
    "h1", "h2", "h3", "h4", "h5", "h6", "p",
    "img", "a", "cards", "free", "nav", "sideNav", "row", "dropdown",
    "radio", "input", "labelInput", "filePicker", "picker", "video",
    "audio", "multiswitcher", "button", "form", "checkbox", "stack",
    "simple", "copy", "wrap", "circle", "polygon", "code", "table", "ulist",
];

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

        // Everything above returned. Falling through used to return
        // `undefined`, which the caller then treated as an element —
        // surfacing much later, and far from the cause, as
        // "Cannot read properties of undefined (reading 'toCode')".
        // A closed vocabulary should say so at the point of the typo.
        throw new Error("[nodality] " + didYouMean(obj.el.type, ELEMENT_TYPES, "element type"));
    }

    static mapTable(obj){


         let el = obj.el;

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
                raster: this.filteroRaster(el.id, obj.customOptions),
          });


   // .render("#mount"); 
 
    }



    static mapRow(obj){

        let el = obj.el;


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
                raster: this.filteroRaster(el.id, obj.customOptions),
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
                raster: this.filteroRaster(el.id, obj.customOptions),
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
  // Any OTHER raster nodes aimed at this element. `copy` itself is
  // consumed above to build the wheel, so it is excluded — leaving it in
  // would attach a GPU copy pass on top of the DOM copies this mapper
  // already emits, and the element would be duplicated twice.
  const copyRaster = (this.filteroRaster(obj.el.id, customOptions) || [])
      .filter((n) => n !== ft);

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
  ${ft?.animation ? animation : ""}${
    // Wrapper routes its options through commonMethods(), so a raster
    // chain serialised here reaches rasterize() when the emitted source
    // runs. Plain data, so JSON.stringify round-trips it.
    copyRaster.length ? `,\n  raster: ${JSON.stringify(copyRaster)}` : ""
  }
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


    // REMOVED: static mapCopya() — unreachable from mapType() and it
    // referenced an undefined `radius`, so any call was a guaranteed
    // ReferenceError. Kept in git history if the ring layout is wanted back.

    // Took NO arguments at all, so `{type: "button", text: "Buy now"}`
    // rendered a hardcoded "Submit" with a demo onTap that logged to the
    // console and a keySet forcing a 3px green border on every button in
    // every page. The label, the handler and the styling are the caller's.
    static button(obj){
        const el = obj.el;
        return new Button(el.text ?? "Button")
        .set({
            fluidc: "S6",
            ...this.elOpts(el),
            raster: this.filteroRaster(el.id, obj.customOptions),
        });
    }

    static multiswitcher(obj){
      

        // Ignored obj: every switcher showed First/Nice/Best. Each
        // breakpoint's `view` is an ELEMENT SPEC now, mapped like any
        // other subtree, so a switcher can hold real content.
        //
        //   { type: "multiswitcher", breakpoints: [
        //       { at: "0px",   view: { type: "h2", text: "Small" } },
        //       { at: "700px", view: { type: "h1", text: "Large" } } ]}
        //
        // Switcher DOES extend Animator, so it has rasterize(); its set()
        // just does not accept a `raster:` key, which is why the chain is
        // attached directly rather than passed through.
        const bps = Array.isArray(obj.el.breakpoints) ? obj.el.breakpoints : null;
        if (!bps || !bps.length) {
            throw new Error('[nodality] a "multiswitcher" element needs a non-empty ' +
                "`breakpoints` array of { at, view }.");
        }
        return new Switcher().set({
            id: obj.el.id,
            area: obj.el.area,
            breakpoints: bps.map((bp) => ({
                at: bp.at,
                // Already a component (someone built it by hand) or a spec.
                view: bp.view && typeof bp.view.render === "function"
                    ? bp.view
                    : this.mapType({ ...obj, el: bp.view }),
            })),
        });
    }

    // REMOVED: the old multiswitcher body — a hardcoded
    // First/Nice/Best fixture that ignored obj entirely. Kept in git
    // history; the version above takes its views from the element.


    // Hardcoded to a w3schools Big Buck Bunny URL. A missing `url` now
    // says so: silently playing someone else's sample reel is worse than
    // an error, because it looks like it worked.
    static video(obj){
        const el = obj.el;
        if (!el.url) throw new Error('[nodality] a "video" element needs a `url`.');
        // Video defines its own set() and never calls commonMethods(), so
        // `raster:` there would be a dead key.
        return this.attachRaster(
            new Video(el.url).set(this.elOpts(el)), el, obj.customOptions);
    }

    // This one did not merely ignore its input, it THREW: Audio defines
    // no set() and Animator has none to inherit, so the old
    // `.set({background})` was a TypeError on every `{type: "audio"}`.
    // Options go to the constructor; styling belongs to the element.
    static audio(obj){
        const el = obj.el;
        if (!el.url) throw new Error('[nodality] an "audio" element needs a `url`.');
        return this.attachRaster(new Audio(el.url), el, obj.customOptions);
    }

    // Ignored obj: every radio group asked Male/Female/Other, and
    // `multiple: true` on a RADIO group was wrong on its face — that is a
    // checkbox. Defaults to single-select now, as radios are.
    //
    // RadioGroup is not an Animator (`class RadioGroup /*extends
    // Animator*/`), so it has no rasterize() and cannot carry raster ops.
    static radio(obj){
        const el = obj.el;
        return new RadioGroup()
        .set({
            items: Array.isArray(el.items) ? el.items : [],
            multiple: el.multiple ?? false,
            ...this.elOpts(el),
        });
    }

    // Ignored obj: every input on every page read "Enter swimming time".
    // `inputType` rather than `type`, because `type` is already the
    // ELEMENT type ("input") — see elOpts.
    static input(obj){
        const el = obj.el;
        return new TextField().set({
            type: el.inputType ?? "text",
            ...this.elOpts(el),
            raster: this.filteroRaster(el.id, obj.customOptions),
        });
      }

      // Ignored obj: every labelled input was titled "Your name".
      static floatInput(obj){
        const el = obj.el;
        return this.attachRaster(new FloatingInput()
          .set({
                  type: el.inputType ?? "input",
                  ...this.elOpts(el),
              }), el, obj.customOptions);
      }

      // Ignored obj, including a hardcoded `id: "A"` — two file pickers
      // on one page produced duplicate DOM ids.
      static filePicker(obj){
        const el = obj.el;
        return this.attachRaster(new FilePickera()
          .set({
              title: el.title ?? "Choose a file",
              ...this.elOpts(el),
          }), el, obj.customOptions);
      }

      // Ignored obj: every picker offered Tesla and Audi.
      static picker(obj){
        const el = obj.el;
        return new Picker()
          .set({
              items: Array.isArray(el.items) ? el.items : [],
              arrayPadding: ({sides: ["all"], value: "0.5rem"}),
              rounded: true,
              ...this.elOpts(el),
              raster: this.filteroRaster(el.id, obj.customOptions),
          });
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

        // Bound rather than returned inline, so the raster chain can be
        // attached below. Dropdown defines its own set() which handles
        // only its own keys and never calls commonMethods(), so a
        // `raster:` option here would be silently dropped.
        const dd = new Dropdown()
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
        ]);

        const ddRaster = this.filteroRaster(obj.el.id, obj.customOptions);
        ddRaster && dd.rasterize(ddRaster);

        return dd;
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



       const navBar = new Switcher()
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
     });

        // A raster chain aimed at this element reaches the component here.
        // Switcher DOES extend Animator (layout/multiswitcher.js) and so it
        // has rasterize() — the comment that said otherwise was wrong, and
        // the real gap was simply that protoNav never forwarded the chain.
        // Its own set() destructures {breakpoints, id, area}, so a `raster:`
        // key would be dropped; attachRaster calls rasterize() directly.
        //
        // Nothing changes for a nav with no raster nodes aimed at it:
        // filteroRaster returns undefined and attachRaster is a no-op, so
        // what {type:"nav"} produces today is untouched.
        return this.attachRaster(navBar, obj.el, customOptions);

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

        // Raster ops, like every other rasterable element.
        //
        // NOT `raster:` in the options above: SideNav configures itself
        // through `setup()`, which builds `this.res` directly and never
        // reaches Animator.commonMethods() — where `obj.raster &&
        // this.rasterize(...)` lives. A `raster` key there would be
        // accepted, ignored, and report nothing, which is the exact bug
        // this is fixing. SideNav extends Animator, so the inherited
        // attach point is called directly instead.
        const rtRaster = this.filteroRaster(obj.el.id, obj.customOptions);
        rtRaster && rt.rasterize(rtRaster);

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

                // Same wiring, same reason as sideNav: Free defines its own
                // set(), which handles only its own keys and never calls
                // commonMethods(), so a `raster:` option would be dead.
                const elaRaster = this.filteroRaster(obj.el.id, obj.customOptions);
                elaRaster && ela.rasterize(elaRaster);

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
                raster: this.filteroRaster(el.id, obj.customOptions),
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
                raster: this.filteroRaster(el.id, obj.customOptions),
  })



  return elo;
 }


    static mapText(obj) {
      //  console.log(obj.el.type);

        let el = obj.el;

    



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
                raster: this.filteroRaster(el.id, obj.customOptions),
                // The caller's own breakpoints. This used to REPLACE them
                // with a two-breakpoint orange/green demo fixture whenever
                // `resprop` was merely present — so asking for responsive
                // styling got you someone else's debugging boxes, and the
                // option appeared to work while doing something unrelated.
                resprop: el.resprop ?? null,
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
            raster: this.filteroRaster(el.id, obj.customOptions),
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
                    // Raster ops. Every CSS-level op above was forwarded and
                    // this was not, so a raster node targeting a link was
                    // accepted, matched nothing, and silently did nothing —
                    // the same class of dead option phase P3 removed from
                    // mapWrap. Link takes `raster` through commonMethods like
                    // every other component; only the wiring was missing.
                    re["raster"] = this.filteroRaster(obj.el.id, obj.customOptions);
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
 let el = obj.el;
     let cardOption = obj.customOptions.find(l => l.op.name === "card-style") ?? {};

       const gradient = this.filtero("gradient", el.id, obj.customOptions);
const animation = this.filtero("animation", el.id, obj.customOptions);
const shadow   = this.filtero("shadow", el.id, obj.customOptions);
const marginOp = this.filtero("margin", el.id, obj.customOptions);
const filtera  = this.filtero("filter", el.id, obj.customOptions);
// Raster nodes carry `op` as a plain string, so `filtero`'s `l.op.name`
// matching never sees them — they need their own selector.
const gridRaster = this.filteroRaster(el.id, obj.customOptions);
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
      }${
        // Raster ops, emitted like every other op above. This mapper
        // returns SOURCE rather than an instance, so the chain is
        // serialised into the generated `.set({...})` instead of being
        // attached to an object. FlexGrid routes its options through
        // commonMethods(), so the emitted code reaches rasterize().
        // Raster nodes are plain data, so JSON.stringify round-trips them.
        gridRaster !== undefined ? `,\n      raster: ${JSON.stringify(gridRaster)}` : ""
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


    // REMOVED: static mapCDiv(obj) — its dispatch in mapType() has been
    // commented out for a long time and the body referenced undefined
    // `rta`, `el` and `i`, so wiring it back up would have thrown.

// Ignored obj: every checkbox was named "acceptTerms" and labelled
// "Check it out!". `label` accepts a plain string — the component wants a
// component, so a string is wrapped here rather than making every caller
// construct a Text.
static checkbox(obj){
    const el = obj.el;
    const label = typeof el.label === "string"
        ? new Text(el.label).set({size: "S6"})
        : el.label;
    return this.attachRaster(new Checkbox().set({
        ...this.elOpts(el, ["label"]),
        ...(label !== undefined ? {label} : {}),
    }), el, obj.customOptions);
}

// Ignored obj: every stack rendered the same photo and "Samuel Suresh".
// Children come from the element now, mapped like any other subtree —
// the same fix mapWrap got in phase P3.
static stack(obj){
    const el = obj.el;
    const st = new Stack().set(this.elOpts(el));
    const kids = Array.isArray(el.children) ? el.children : null;
    if (kids) st.add(kids.map((child) => this.mapType({ ...obj, el: child })));
    return this.attachRaster(st, el, obj.customOptions);
}

// Ignored obj: every form posted to "file.php" and contained the same
// five demo fields (a name, an email, a gender radio, a car picker and a
// profile-picture upload), whatever the caller asked for. Fields come
// from `children` now, mapped like any other subtree.
//
//   { type: "form", action: "/subscribe", method: "post", children: [
//       { type: "labelInput", title: "Your email", name: "email" },
//       { type: "button", text: "Subscribe" } ]}
//
// Form is not an Animator (`class Form {`), so it has no rasterize() and
// cannot carry raster ops.
static form(obj){
    const el = obj.el;
    const form = new Form().set({
        action: el.action ?? "",
        ...(el.method !== undefined ? { method: el.method } : {}),
    });
    const kids = Array.isArray(el.children) ? el.children : null;
    if (kids) form.add(kids.map((child) => this.mapType({ ...obj, el: child })));
    return form;
}

    // REMOVED: the old form body — a hardcoded five-field demo. Kept in
    // git history; the version above builds from `children`.
    // Ignored obj: every "simple" element emitted the same AreaSwitcher —
    // three fixed breakpoints of a/b/c/d/e templates and five "Hello A…E"
    // texts. The regions and the children are the caller's now.
    //
    //   { type: "simple", gap: "10px", height: "700px",
    //     react: [{ at: "0", template: ["aa", "bb"] },
    //             { at: "768", template: ["ab"] }],
    //     children: [{ type: "h1", text: "A" }, { type: "p", text: "B" }] }
    //
    // Emits SOURCE rather than an instance, like mapGrid and mapCopy, so
    // children are mapped and then serialised through their own toCode().
    static simple(obj){
        const el = obj.el;
        const react = Array.isArray(el.react) ? el.react : [];
        if (!react.length) {
            throw new Error('[nodality] a "simple" element needs a non-empty `react` ' +
                "array of { at, template }.");
        }
        const kids = Array.isArray(el.children) ? el.children : [];
        const kidSrc = kids
            .map((child) => {
                const code = this.mapType({ ...obj, el: child }).toCode();
                return Array.isArray(code) ? code.join("") : String(code);
            })
            .join(",\n    ");

        return `new AreaSwitcher()
  .set(${JSON.stringify({
        gap: el.gap ?? "10px",
        height: el.height ?? "700px",
        ...(el.id !== undefined ? { id: el.id } : {}),
    })})
  .react(${JSON.stringify(react, null, 2)})
  .add([
    ${kidSrc}
  ])`;
    }

    static mapWrap(obj) {
        let el = obj.el;

//console.log("GRQDOE"); // remove text flag from lin gradient when ding this on wrapper
//console.log(obj.customOptions);

        let kind = obj.el.kind ?? "";

        // The caller's own options, then the node-derived ones. Everything
        // the element declares reaches the Wrapper — this used to forward a
        // fixed allowlist (id/class/color/size/font/keySet + the op slots)
        // and drop the rest, so a `wrap` element could not carry a width, a
        // background, or a grid.
        //
        // `size` is NOT defaulted here any more. It used to be
        // `getElType(el.type)`, which for type "wrap" produced the string
        // "Srap" — getElType slices the digit off h1…h6 and has nothing to
        // slice on a word. A caller-supplied `size` still passes through.
        const wrapper = new Wrapper(kind)
            .set({
                ...el,
                font: el.font ?? "Arial",
                stroke: this.filtero("blast", el.id, obj.customOptions),
                gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
                raster: this.filteroRaster(el.id, obj.customOptions),
            });

        // Children come from the element. There used to be three
        // `new Text("Hello")` here unconditionally, so every `wrap` in
        // every page rendered the same placeholder content and no page
        // could put anything of its own inside one.
        const kids = Array.isArray(el.children) ? el.children : null;
        if (kids) {
            wrapper.add(kids.map((child) =>
                this.mapType({ ...obj, el: child })));
        }
        return wrapper;
    }



    static mapUList(obj) {
        let el = obj.el;

//console.log("GRQDOE"); // remove text flag from lin gradient when ding this on wrapper
//console.log(obj.customOptions);

        let kind = obj.el.kind ?? "";



        // Same two fixes as mapWrap: the element's own options reach the
        // component, and `size` is not defaulted to the "Srap"-shaped
        // output of getElType on a non-heading type.
        const list = new UList(kind)
            .set({
                ...el,
                font: el.font ?? "Arial",
                stroke: this.filtero("blast", el.id, obj.customOptions),
                gradient: this.filtero("gradient", el.id, obj.customOptions),
                animation: this.filtero("animation", el.id, obj.customOptions),
                shadow: this.filtero("shadow", el.id, obj.customOptions),
                transform: this.filtero("transform", el.id, obj.customOptions),
                filtera: this.filtero("filter", el.id, obj.customOptions),
                raster: this.filteroRaster(el.id, obj.customOptions),
            });

        // `items` are the list's own; the hardcoded First/Second/Third
        // placeholders they replace made every ulist identical.
        const items = Array.isArray(el.items) ? el.items : null;
        if (items) {
            list.setItems(items.map((item) => (typeof item === "string"
                ? new Text(item).set({})
                : this.mapType({ ...obj, el: item }))));
        }
        return list;
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


    // h1..h6 -> S1..S6. `p` has no digit to slice, so this used to produce the
    // string "S", and fluidCopy() (which only branches on S1..S6) then silently
    // applied no fluid sizing at all to every paragraph.
    static getElType(type) {
        if (type === "p") return "S6";
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

    // Raster ops (lib/raster-ops.js) — unlike filtero, the whole ordered
    // list matters: ops chain in nodes-array order (hexalize -> offset ->
    // duotone). Raster nodes carry `op` as a plain string, so they are
    // invisible to filtero's `l.op.name` matching and never collide with
    // the CSS-level ops. Returns undefined when nothing applies so the
    // property is dropped from the generated code.
    /**
     * The element's own options, minus the keys that belong to the mapper
     * rather than to the component.
     *
     * `type` is always dropped: it is the ELEMENT type ("input"), not an
     * `<input type>`, and spreading it into a field component would set
     * type="input" on the DOM node. Components that want an HTML type read
     * `inputType` instead.
     */
    static elOpts(el, drop = []) {
        const skip = new Set(["type", "children", "items", "breakpoints",
            "inputType", "text", "url", ...drop]);
        const out = {};
        for (const k of Object.keys(el)) if (!skip.has(k)) out[k] = el[k];
        return out;
    }

    /**
     * Attach a raster chain to a component whose own `set()` bypasses
     * Animator.commonMethods() — where `obj.raster && this.rasterize(...)`
     * lives. Passing `raster:` to those would be a silently dropped key.
     *
     * Returns the instance so it can be used inline. Components that are
     * not Animators at all (Form, RadioGroup, Switcher) have no
     * `rasterize`; they are skipped rather than crashed, and the gap is
     * recorded in the element-mapper tests.
     */
    static attachRaster(inst, el, customOptions) {
        const chain = this.filteroRaster(el.id, customOptions);
        if (chain && inst && typeof inst.rasterize === "function") inst.rasterize(chain);
        return inst;
    }

    static filteroRaster(id, customOptions) {
        const list = (customOptions || []).filter((l) =>
            l && typeof l.op === "string" && RASTER_OP_NAMES.includes(l.op) &&
            (!l.target || (id && l.target.includes(id))));
        return list.length > 0 ? list : undefined;
    }
}


export {ElementMapper};