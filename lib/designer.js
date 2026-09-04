/*!
 * nodality v1.3.4
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/* Classes:
ElementMapper
*/

// CORE
import { ElementMapper } from "../lib/element-mapper.js";
import { applyMorphNodes } from "../lib/morph-node.js";
import { installAgentSurface } from "../lib/webmcp-adapter.js";
import { annotateRoundTrip } from "../lib/parse-html.js";
import { resolveRefs, collectRefs } from "../lib/resolve-refs.js";
import { normalizeSpec } from "../lib/normalize-spec.js";
import { Animator, resetDeprecationNotices } from "../layout/animator.js";
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



// Audio, progress, TextField, import navFactor
class Des {
    constructor() {
        // A fresh build reports its deprecations afresh. Cleared HERE and not
        // in `set()`, because the first of the two constructions happens back
        // in `add()` — the mapper builds each component to obtain `toCode()`
        // — so clearing at render time would wipe that notice and let the
        // eval pass re-emit it, which is the doubling this removes.
        resetDeprecationNotices();
        this.items = [];
        this.options = [];
        this.code = [];
        this.ready2Render = [];
        this.stor = {
            text:
            {
            miami: {
                code: `new Text("Hello").set({fluidc: "S3", color: "orange"})`,
            },
            base: {
                code: `new Text("Hello").set({fluidc: "S3", color: "orange"})`,
            },
            nepal: {
                code: `new Text("Hello").set({fluidc: "S3", color: "#2ECC71", font: "Helvetica Neue"})`,
            },
            patagonia: {
                code: `new Text("Hello").set({fluidc: "S3", color: "#3498DB", font: "DIN Alternate"})`,
            },
        },

        complexa: {
            code: `new Wrapper()
                  .set({...}) // Rest of the code omitted for brevity`
        },

       complex: {
            code: `new Wrapper() 
	.set({
		
		responsive: {
			ranges: ["700px", "1200px", "1400px"],
			sequence: "col-row-col"
		}
	})
	.add([
		new Image("img/wix.jpeg").set({
			width: "100%",
			height: "200px",
             objectFit: "cover"
		}),

        new Wrapper().set({
        responsive: {
			ranges: ["700px", "1200px", "1400px"],
			sequence: "col-col-row"
		}
        }).add([
            new Text("Running in the desert").set({
                size: "S3",
                font: "Arial",
                color: "orange"
            }),

              new Text("This is example content").set({
                exact: "1rem",
                font: "Arial"
            }),


            new Image("img/wix.jpeg").set({
                width: "100%",
                height: "300px",
                objectFit: "cover"
            })
        ])
	])`
        }, ops: {
            miami: {
                blast: {
                    code: `stroke: {range:["0px","3000px"], op:{name:"blast",color:"orange",width:"3px"}}`,
                },
                blastFun: (val) => {
                    return `stroke: {range:["0px","3000px"], op:{name:"blast",color:"orange",width:"${val}px"}}`;
                },
            },
            nepal: {
                blast: {
                    code: `stroke: {range:["0px","3000px"], op:{name:"blast",color:"#2ECC71",width:"3px"}}`,
                },
                blastFun: (val) => {
                    return `stroke: {range:["0px","3000px"], op:{name:"blast",color:"#2ECC71",width:"${val}px"}}`;
                },
            },
            patagonia: {
                blast: {
                    code: `stroke: {range:["0px","3000px"], op:{name:"blast",color:"#1abc9c",width:"3px"}}`,
                },
                blastFun: (val) => {
                    return `stroke: {range:["0px","3000px"], op:{name:"blast",color:"#1abc9c",width:"${val}px"}}`;
                },
            },
        },

        link: {
            miami: {
                code: `new Link("Link").set({text: "Hello", url: "#a", background: "", color: "orange", hover: {color: "white", background: "orange", animation: 0.6}, borderObj: {color: "orange", width: "3px", radius: "0.7rem"}, pad: { sides: ["all"], value: "0.6rem" }, mar: { "t": 0.8rem }, radius: "0.4rem"})`,
            },
            base: {
                code: `new Link("Link").set({text: "Hello", url: "#ai", background: "#3498db", pad: [{lr: "0.5rem", tb: "1rem"}], radius: "0.4rem", color: "white"})`,
            },
            nepal: {
                code: `new Link("Link").set({text: "Hello", url: "#a", background: "#2ECC71", pad: { sides: ["all"], value: "0.6rem" }, mar: { sides: ["top", "bottom"], value: "0.8rem" }, hover: {color: "#2ECC71", background: "white", border: true, animation: 0.3}, color: "white"})`,
            },
            patagonia: {
                code: `new Link("Link", "#a").set({text: "Hello", url: "#a", background: "#1ABC9C", pad: { sides: ["all"], value: "0.6rem" }, mar: { sides: ["top", "bottom"], value: "0.8rem" }, hover: {color: "#2ECC71", background: "white", border: true, animation: 0.3}, color: "white"})`,
            },
        },

        grid: {
            code: ` new AreaSwitcher()
    .set({
        gap: "1rem"
    })
    .react([{
            at: "0px",
            template: [
                "eeeeee",
                "eeeeee",
                "abbbbb",
                "abbbbb",
                "abbbbb",
                "cccccc",
                "cccccc",
                "dddddd"
            ]
        },

        {
            at: "900px",
            color: "orange",
            template: [
                "aaaccc",
                "aaaccc",
                "bbbbbb",
                "dddddd",
                "eeeeee"
            ]
        },

        {
            at: "1200px",
            color: "purple",
            template: [
                "cccaaa",
                "cccaaa",
                "bbbbbb",
                "dddddd",
                "eeeeee"
            ]
        },
    ])
    .add([
        new Wrapper().set({
            pad: [{
                a: 20
            }],
            background: "#ecf0f1",
            radius: "1.7rem"
        }).add([
            new Text("NEW PRODUCT").set({
                exact: "1rem",
                font: "Oswald",
                width: "100%"
            }),
            new Text("Feel").set({
                fluidc: "S2",
                font: "Oswald",
                width: "100%",
                color: "black"
            }),
            new Text("Speed").set({
                exact: "7rem",
                font: "Oswald",
                width: "100%",
                color: "#3498db"
            }),
        ]),

        new Wrapper().set({
            pad: [{
                a: 20
            }],
            background: "#ecf0f1",
            radius: "1.7rem"
        }).add([
            new Text("TOP QUALITY").set({
                exact: "1rem",
                font: "Oswald",
                width: "100%"
            }),
            new Text("Amazing animals").set({
                fluidc: "S2",
                font: "Oswald",
                width: "100%",
                color: "black"
            }),

            new Text("Seals are intelligent, agile marine mammals found in oceans around the world, known for their streamlined bodies, flippers, and ability to thrive both in water and on land. Belonging to the pinniped family, they are divided into true seals, which lack external ears, and eared seals like sea lions, which are more mobile on land. Seals feed primarily on fish and squid, using their sensitive whiskers to detect prey underwater, and can dive to great depths while holding their breath for extended periods. Adapted to cold environments with thick blubber for insulation, seals play a crucial role in marine ecosystems but face threats from climate change, pollution, and human activity, making conservation efforts increasingly important.")
            .set({
                font: "Arial",
                exact: "1.3rem"
            })

        ]),

        new Wrapper().set({
            radius: "1.7rem",
            overflow: "hidden"

        }).add([

            new Image("https://cdn.pixabay.com/photo/2017/02/09/18/40/seal-2053165_640.jpg", "exact").set({
                width: "100%",
                height: "420px",
                minHeight: "100px",
                objectFit: "cover"

            })
        ]),

        new Wrapper().set({
            pad: [{
                a: 20
            }],
            background: "#ecf0f1",
            radius: "1.7rem",
        }).add([
            new Text("Welcome seals").set({
                fluidc: "S3",
                font: "Oswald",
                color: "black"
            }),
           
        ]),
        new Wrapper().set({
            mc: true,
            pad: [{
                a: 20
            }],
            background: "#ecf0f1",
            radius: "1.7rem",

        }).add([new Text("Top line").set({
            font: "Arial",
            exact: "1.3rem"
        }), ]),
    ])`, // Rest omitted for brevity
        },

        flexRow: (colat) => ({
            image: {
                code: `new FlexRow().set({border: ["all", "3px"], colat: "600px"}).items([new Image(...), new Image(...), new Image(...)])`,
            },
            text: {
                code: `new FlexRow().set({}).items([

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
    
])`,
            },
        }),

        tabSpace : (len) => {
            return '    '.repeat(len);
        }
    }
}
        
        
     
    

    // Deep copy so the caller's node objects are never written to. add()
    // rewrites entries in place (op replacement, `medium`/`fast` expansion,
    // deletion of keys valued "default"), which used to mutate the array the
    // user passed in — making a nodes array unusable for a second Des, or
    // corrupting it when it came from framework state.
    static cloneNodes(arr) {
        if (!Array.isArray(arr)) return [];
        try {
            if (typeof structuredClone === "function") return structuredClone(arr);
        } catch (e) {
            // Node objects may carry functions (e.g. onTap) which
            // structuredClone rejects; fall through to the manual copy.
        }
        const copy = (v) => {
            if (Array.isArray(v)) return v.map(copy);
            if (v && typeof v === "object") {
                const o = {};
                for (const k in v) o[k] = copy(v[k]);
                return o;
            }
            return v;
        };
        return arr.map(copy);
    }

    at(opts) {
        // Keep options/protoOptions in lockstep — add() indexes into
        // protoOptions by the same q, so pushing to only one of them
        // threw on the first .at() used without .nodes().
        if (!Array.isArray(this.options)) this.options = [];
        if (!Array.isArray(this.protoOptions)) this.protoOptions = [];
        const one = Des.cloneNodes([opts])[0];
        this.options.push(one);
        this.protoOptions.push(one);
        return this;
    }

    nodes(arr) {
        this.options = Des.cloneNodes(arr);
        this.protoOptions = Des.cloneNodes(arr);
        return this;
    }

    // Kept in sync with ElementMapper.getElType — see the note there about `p`.
    getElType(type) {
        if (type === "p") return "S6";
        return `S${type.substr(1)}`;
    }

    // What if there is multiple objects?
    filtero(name, id, customOptions) {
        // console.warn(customOptions
        //    .filter(l => l.op.name === name));
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

    add(arr) {

        // Kept for phase T: a morph node resolves `from`/`to` ids against
        // the rendered children BY POSITION, so it needs the descriptor
        // order — components do not all carry their id into the DOM.
        // Tier 3: `{ $ref: "name" }` is expanded here, so everything
        // downstream — the mapper, morph nodes resolving by position, the
        // agent surface, annotation — sees ordinary elements and needs no
        // knowledge of references at all. No defs, no change: `resolveRefs`
        // returns its input untouched.
        arr = resolveRefs(Array.isArray(arr) ? arr : [], this._defs);

        // Tier 6: `src`/`href` mean `url`, `options` means `items`. Rewritten
        // once, here, so the mapper and every component below it only ever see
        // the canonical names and none of them needs to know an alias exists.
        // Additive — a spec using the canonical names comes through unchanged.
        arr = normalizeSpec(arr);

        // A name with no definition is refused here, naming what is defined.
        // Left alone it reaches the mapper as an element with no `type` and
        // fails as `Unknown element type "undefined"`, which sends the reader
        // looking for a typo in a type rather than a missing definition.
        {
            const dangling = collectRefs(arr).filter(
                (r) => !this._defs || !Object.prototype.hasOwnProperty.call(this._defs, r.name));
            if (dangling.length) {
                const defined = Object.keys(this._defs || {});
                throw new Error(
                    `[nodality] no definition for $ref "${dangling[0].name}" at ` +
                    `${dangling[0].path}. Defined: ${defined.length ? defined.join(", ") : "(none)"}`);
            }
        }

        this.css = [];
        this.elCSS = [];
        this.elHTML = [];

        let customOptions = this.options;

customOptions.forEach(item => {
  if (item.direction === "radial" ) {
  //  alert("//")
    item.gradient = "radial-gradient(orange, green)";
  }
});



//console.log(updated);

//customOptions = updated;

        // Navbar elements ({type: "nav"} / {type: "sideNav"}) are
        // semantically a page chrome layer and should always render at
        // the top of the mount regardless of where the user put them
        // in the elements array. Lift them to the front while keeping
        // each group's internal order stable.
        arr = [
          ...arr.filter((e) => e && (e.type === "nav" || e.type === "sideNav")),
          ...arr.filter((e) => !e || (e.type !== "nav" && e.type !== "sideNav")),
        ];

        // Recorded AFTER the lift, not before. Everything that consumes
        // `_elements` matches it against rendered children BY POSITION —
        // morph resolving `from`/`to`, and the round-trip writing each
        // descriptor onto the node it produced. The array was being stored in
        // the author's order while the page rendered in this one, so any spec
        // with a nav after another element mapped descriptors to the wrong
        // nodes. Found while wiring Tier 3, which needed the same array.
        this._elements = arr;

        for (var i = 0; i < arr.length; i++) {
            let el = arr[i];
            let ela = null;

            let ops = ["blast", "gradient", "shadow", "filter", "animation", "transform", "span"];
            let replacementObjects = [
                {
                    // range: ["0px", "1900px"],
                    op: {
                        name: "blast",
                        color: "green",
                        width: "1px"
                    },
                },

                { // 18:00:08 OK!!! 25/04/2025

                    op: {
                        name: "gradient",
                        // gradient: "linear-gradient(#3498db,#1abc9c)"
                        gradient: "linear-gradient(orange, green)",
                     //   direction: "radial"
                    },

                },

             /*   {

                    op: {
                        name: "shadow",
                        color: "#1abc9c",
                        steps: 3
                    },
                },*/
            {
                 op: {
                        name: "shadow",
                        color: "#1abc9c",
                        steps: 3,
                        colors: ["orange", "green", "yellow"]
                    }
                },

                {
                    // range: ["0px", "2000px"],
                    op: {
                        name: "filter",
                        filter: "grayscale(0.7)"
                    }, // shadow resets filter so that's okay
                    //target: ["#imga", "#eimga"]
                },

                {
                    op: {
                        name: "animation",
                        color: "green",
                        width: "1px",
                        fireAt: "inview",
                        keyframesOpen: [{
                            transform: "translate(100%, 0%)",
                            opacity: 0
                        }, {
                            transform: "translate(0%)",
                            opacity: 1
                        }],
                        keyframesClose: [{
                            transform: "translate(0%)",
                            opacity: 1
                        }, {
                            transform: "translate(100%, 0%)",
                            opacity: 0
                        }],
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
                    }
                },

                {
                    op: {
                        name: "transform",
                        values: [ // This can be empty or have any order of values
                            "ty:-20px",
                            "scale(3)",
                            "rotate(3deg)",
                            "skew(3deg, 0deg)",
                            "perspective(100px)",
                            "matrix(1, 0, 0, 1, 50, 50)"
                        ],
                    }
                },

                  {
                    op: {
                        name: "span",
                        parts: [
        {
          text: "The first time",
          style: {
            italic: true,
            arrpad: {
              sides: ["left"],
              value: "3rem"
            },
            stroke: {
              range: ["950px", "1000px"],
              op: {
                name: "blast",
                background: ["header", "button"],
                color: "yellow",
                width: "1px"
              }
            }
          }
        },
        {
          text: "We went to the Moon",
          style: {}
        }
      ]
                    }
                }
            ];

            /*console.log("OPS");
            
            */


            for (var q = 0; q < ops.length; q++) {
                let blastIDs = customOptions.map(l => l.op)
                    .map((value, index) => value === ops[q] ? index : '').filter(String);

                if (blastIDs.length > 0) {
                    for (var d = 0; d < blastIDs.length; d++) {
                        let index = blastIDs[d];
                        // should run only once once but the next should not disappear
                        let target = customOptions[index].target;
                        let range = customOptions[index].range;
                        let filter = customOptions[index].filter;
                        let gradient = customOptions[index].gradient;
                        let color = customOptions[index].color;
                        let width = customOptions[index].width;

                        // Clone per index. This used to assign the SAME
                        // replacementObjects[q] object to every node of the
                        // same op kind, so two `blast` nodes with different
                        // targets/colors collapsed into one — each iteration
                        // overwrote the previous one's target and the last
                        // write won for all of them.
                        let as = Des.cloneNodes([replacementObjects[q]])[0];
                        as.target = target;

                        if (range != null) {
                            as.range = range;
                        }

                        // Do this for all
                        if (filter != null) { // This works!!!
                            as.op.filter = filter;
                        }

                        if (gradient != null) {
                            as.op.gradient = gradient;
                          //  alert("PPP")
                           // as.op.dir = "radial";
                        }

                        // Op-level color/width override, blast only, so
                        // other ops that might carry these fields are
                        // untouched (e.g. { op: "blast", color: "#fff",
                        // width: "3px" }).
                        if (ops[q] === "blast") {
                            if (color != null) {
                                as.op.color = color;
                            }
                            if (width != null) {
                                as.op.width = width;
                            }
                        }

                        customOptions[index] = as;
                    }
                }
            }




            for (var q = 0; q < customOptions.length; q++) {
                let option = customOptions[q].op.name;

                let cool = this.protoOptions[q].style || "default";
                let duration = this.protoOptions[q].duration || "default";

                if (option === "transform") {
                    let opts = [];

                    if (cool === "SOLARIUM") {

                        opts = [ // This can be empty or have any order of values
                            "scale(3)"
                        ];

                    } else if (cool === "WAVE") {
                        opts = [
                            "skew(15deg, 0deg)",
                            "tx:50px",
                            "rotate(10deg)",
                            "scale(1.1)"
                        ];
                    } else if (cool === "CUBE-SPIN") { // works
                        opts = [
                          //  "rotate(90deg, 90deg)", TWO VALUES ROTATE PROBLEM
                            "perspective(700px)",
                            "scale(0.9)"
                        ];
                    } else if (cool === "TORNADO-SWITCH") { // not working
                        opts = [
                            "rotate(720deg)",
                            "scale(0.8)",
                            "tx:30px",
                            "ty:-50px",// NOT WORKINg WITH TY
                            "tz:-80px"
                            // "skew(10deg, 0deg)"
                        ];
                    } else if (cool === "LASER-SWEEP") {
                        //  alert("P")
                        opts = [

                            "tx:100px",
                            "opacity:0.2",
                            "scale(1.2, 1.0)"

                        ];
                    } else if (cool === "TORNADO-TWIST") {
                        opts = [
                            "rotate(720deg)",
                            "scale(0.8)",
                            "tx:30px",
                            "ty:-50px",
                            "skew(10deg, 0deg)"
                        ];
                    }
                    else if (cool === "JELLY-WOBBLE") {
                        opts = [
                            "scale(1.2, 0.8)",
                            "rotate(5deg)",
                            "ty:-10px",
                            "skew(5deg, 0deg)"
                        ];
                    }
                    else if (cool === "DRUNKEN-SWAY") {
                        opts = [
                            "rotate(15deg)",
                            "tx:20px",
                            "ty:-10px",
                            "skew(10deg, 5deg)"
                        ];
                    }
                    else if (cool === "FLAME-FLICKER") {
                        opts = [
                            "scale(1.1, 0.9)",
                            "rotate(-5deg)",
                            "ty:5px",
                            "opacity:0.7"
                        ];
                    }
                    else if (cool === "PHANTOM-SHIFT") {
                        opts = [
                            "tx:15px",
                            "ty:-5px",
                            "opacity:0.5",
                            "skew(5deg, 5deg)"
                        ];
                    }
                    else if (cool === "RUBBER-BOUNCE") {
                        opts = [
                            "scale(1.3, 0.8)",
                            "skew(10deg, 0deg)",
                            "ty:-20px"
                        ];
                    }
                    else if (cool === "ASTEROID-CRASH") {
                        opts = [
                            "tx:-80px",
                            "ty:100px",
                            "rotate(45deg)",
                            "scale(0.7)",
                            "opacity:0.5"
                        ];
                    }
                    else if (cool === "CYBER-GLITCH") {
                        opts = [
                            "tx:5px",
                            "ty:-5px",
                            "rotate(3deg)",
                            "opacity:0.6",
                            "scale(1.05)"
                        ];
                    }
                    else if (cool === "BUBBLE-POP") {
                        opts = [
                            "scale(1.5)",
                            "opacity:0.3",
                            "ty:-20px"
                        ];
                    }
                    else if (cool === "SUPERNOVA-BURST") {
                        opts = [
                            "scale(2)",
                            "opacity:0",
                            "tx:50px",
                            "ty:-50px"
                        ];
                    }
                    else if (cool === "GRAVITY-DROP") {
                        opts = [
                            "ty:100px",
                            "scale(0.8)",
                            "rotate(10deg)",
                            "skew(0deg, 10deg)"
                        ];
                    }
                    else if (cool === "LASER-SWEEP") {
                        opts = [
                            "tx:100px",
                            "opacity:0.2",
                            "scale(1.2, 1.0)"
                        ];
                    }
                    else if (cool === "VORTEX-SINK") {
                        opts = [
                            "rotate(-360deg)",
                            "scale(0.5)",
                            "ty:50px"
                        ];
                    }
                    else if (cool === "SHOCKWAVE") {
                        opts = [
                            "scale(1.7)",
                            "opacity:0.4",
                            "skew(5deg, 5deg)"
                        ];
                    }

                    else {
                        opts = [ // This can be empty or have any order of values
                            "ty:20px",
                            "tx:30px",
                         //   "scale(3)",
                            "rotate(3deg)",
                            "skew(40deg, 0deg)",
                           // "perspective(500px)",
                       //     "matrix(1, 0, 0, 1, 50, 50)"
                        ];
                    }
/*
if (duration === "default"){
    duration = "MEDIUM";
}
                    if (duration === "FAST") {
                        duration = "3s-ease-in-out"; // divide entered value by two 
                        // 6s is for both leaving and entering
                    } else if (duration === "MEDIUM"){
                        duration = "6s-ease-in-out";
                    } else if (duration === "SLOW"){
                        duration = "10s-ease-in-out";
                    } */


if (/*q == i*/ true){ // 23:07.20 Nice!!!! 23:04 bef
    // 193615 Nice!!!
//alert("MESS UP");

                    customOptions[q].op = {
                        name: "transform",
                        values: opts,
                        duration: duration
                    }



                   

                    let key = "style"; // The key you want to remove

                    let dur = "duration"; // The key you want to remove


                    // 15:07:47 Nice 02/04/25
                    if (customOptions[q]?.op && key in customOptions[q].op) {
                        delete customOptions[q].op[key]; // remove in both logs, weird
                    }

                    if (customOptions[q]?.op && dur in customOptions[q].op) {
                        delete customOptions[q].op[dur]; // remove in both logs, weird
                    }

                    if (customOptions[q]?.op.values){

                 //   alert("P")

                    let values = "values";

                    if (customOptions[q]?.op.values) {
                      //  delete customOptions[q].op[values]; // remove in both logs, weird
                    }
                }

                   

                    
                }
                



                }
            } // for q = cycle end

           


            function replaceMedium(obj) {
  /*for (let key in obj) {
    if (typeof obj[key] === "object") {
      replaceMedium(obj[key]); // dive deeper
    } else if (obj[key] === "medium") {
      obj[key] = "6s-ease-in-out";
    } else if (obj[key] === "fast") {
      obj[key] = "3s-ease-in-out";
    }  else if (obj[key] === "slow") {
      obj[key] = "9s-ease-in-out";
    } else if (obj[key] === "default"){
       delete obj[key];
    }
  }*/

   /*  for (let key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      replaceMedium(obj[key]); // dive deeper
    } else if (obj[key] && obj[key].toLowerCase() === "medium") {
      obj[key] = "6s-ease-in-out";
    } else if (obj[key] && obj[key].toLowerCase() === "fast") {
      obj[key] = "3s-ease-in-out";
    } else if (obj[key] && obj[key].toLowerCase() === "slow") {
      obj[key] = "9s-ease-in-out";
    } else if (obj[key] && obj[key].toLowerCase() === "default") {
     // alert("PP");
      delete obj[key]; // works now
    }
  }*/

    for (let key of Object.keys(obj)) {
  if (typeof obj[key] === "object" && obj[key] !== null) {
    replaceMedium(obj[key]); // dive deeper
  } else if (typeof obj[key] === "string") {
    switch (obj[key].toLowerCase()) {
      case "medium":
        obj[key] = "6s-ease-in-out";
        break;
      case "fast":
        obj[key] = "3s-ease-in-out";
        break;
      case "slow":
        obj[key] = "9s-ease-in-out";
        break;
      case "default":
        delete obj[key];
        break;
    }
  }
}
}

replaceMedium(customOptions);

           

            const matchEls = ["h1", "h2", "h3", "h4", "h5", "h6", "p"].includes(el.type) || el.type === "img" || el.type === "a";
           
            if (matchEls) { 
             
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i
                });

                if (ela.toCode){
                    this.code.push(ela.toCode().join(""));
                } else {
                    this.code.push(ela);
                }
               
                this.ready2Render.push(ela);
                ela = ela.render();

            } else if (el.type === "table"){
 /*this.code.push(`
    new Table()
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
              borderRadius: 2.2
          })
    `);*/

       ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela.toCode());


            } else if (el.type=== "slider"){
                this.code.push(`  
let texts = [

new Text("One").set({size: "S1", color: "#1abc9c", font: "Arial"}),
    /*new Image().set({
    url: "https://image.datart.cz/foto/500/7/0/8/product_7766807.jpg",
    width: "400px",
    height: "auto"
    }),*/

    new Text("Two").set({size: "S1", color: "#1abc9c", font: "Arial"}),
    
    new Text("Three").set({size: "S1", color: "#1abc9c", font: "Arial"}),

    new Text("Four").set({size: "S1", color: "#1abc9c", font: "Arial"}),
];

new Slider(texts, null, { tintColor: "#e74c3c", inactiveColor: "#ccc" })
 
`);

            } else if (el.type === "hslider") {
                this.code.push(`
             new HScroller()
            .seto({
            height: "300px",
                speed: 1.0 // the bigger the slower
            })
            .add([
                new Text("First").set({size: "S1", pad: [{"a": 40}] }),
                new Text("Second").set({size: "S1", pad: [{"a": 40}] }),
                new Text("Third").set({size: "S1", pad: [{"a": 40}] })
            ])
            `
);
            } else if (el.type === "grid") {
                this.code.push(
                    this.stor.grid.code
                );
            } else if (el.type === "modal"){
                this.code.push(`new Code()
                    .set({
                        pad: [
                            { l: 30 },
                        ], 
                        mar: [
                            { a: 30 },
                        ], 
                        class: "language-js",
                        code: \`
                // You need to copy and paste this example


                import {Animator} from "../layout/animator.js";
                import {Text} from "../layout/text.js";
                import {Modal} from "../layout/modal-2025.js";
                import {Stack} from "../layout/stack.js";
                import {Image} from "../layout/image.js";
                import {FlexRow} from "../layout/flex-row.js";
                import {Button} from "../layout/button.js";
                import {Spacer} from "../layout/spacer.js";
                import {Wrapper} from "../layout/container.js";
                
                
                let firstLong = "Apple today announced that the company has surpassed a 60 percent reduction in its global greenhouse gas emissions compared to 2015 levels, as part of its Apple 2030 goal to become carbon neutral across its entire footprint in the next five years. The company achieved several other major environmental milestones, including the use of 99 percent recycled rare earth elements in all magnets and 99 percent recycled cobalt in all Apple-designed batteries.1 Apple shared this and other progress in its annual Environmental Progress Report, published today.
                “We’re incredibly proud of the progress we’re making toward Apple 2030, which touches every part of our business,” said Lisa Jackson, Apple’s vice president of Environment, Policy, and Social Initiatives. “Today, we’re using more clean energy and recycled materials to make our products than ever before, we’re preserving water and preventing waste around the world, and we’re investing big in nature. As we get closer to 2030, the work gets even harder — and we’re meeting the challenge with innovation, collaboration, and urgency.
                Apple’s 2030 strategy prioritizes cutting greenhouse gas emissions by 75 percent compared with its 2015 baseline year, before applying high-quality carbon credits to balance the remaining emissions. Last year, Apple’s comprehensive efforts to reduce its carbon footprint — including the continued transition of its supply chain to renewable electricity and designing products with more recycled materials — avoided an estimated 41 million metric tons of greenhouse gas emissions.";
                
                    let elements = [
                        new Stack()
                        .setup({})
                        .add([
                            new Image("https://pbs.twimg.com/media/DwYvbCBVAAEKY_R.jpg").set({}),
                          
                            new FlexRow().set({aligns: "start"}).items([
                          
                            new Button("×")
                          
                                    .set({
                                        fluidc: "S3",
                                        onTap: () => modal.close(),
                                        frame: { width: 80, height: 80 },
                                        color: "white",
                                        background: "none"
                                    }),
                
                                    new Spacer(true),
                            ])
                        ]),
                     
                     
                            new Text("Samuel Suresh")
                            .set({
                                color: "#00ae56",
                                font: "SF Pro Display",
                                fluidc: "S2",
                                pad: [{"tl": 20}]
                            }),
                          
                        
                            new Text("Studying Science and Business, Western Sydney University, class of 2022")
                              .set({
                                font: "Arial",
                                fluidc: "S6",
                                pad: [{"l": 20}]
                              }),
                
                
                            new Text(firstLong)
                              .set({
                                font: "Arial",
                                fluidc: "S6",
                                pad: [{"l": 20}]
                              }),  
                    ];
                
                
                    let wrapper = new Wrapper()
                                .set({})
                                .add(elements);
                    
                    
                  let modal = new Modal();
                        modal
                        .set({
                             width: "600px", 
                             background: "#469d73cc",
                             close: true
                        })
                        .add([wrapper])
                        .render("#res");    
                
                    
                    new Button("Wow")
                    .set({
                        fluidc: "S3",
                        onTap: () => modal.show()
                    })
                    .render("#res");
                
                \`
                    })`
                );
                
            }
            
            /*else if (el.type === "nav") {

                if (el.isSide) {
                    this.code.push(
                        storage.sideNav({ items: el.items, animate: el.animate }).code
                    );
                } else {
                    this.code.push(
                        storage.nav({ items: el.items, animate: el.animate }).code
                    );
                }

            }*/ else if (el.type === "row") {

               /* if (el.child === "img") {
                    this.code.push(this.stor.flexRow(el.colat).image.code);
                } else {
                    this.code.push(this.stor.flexRow(el.colat).text.code);
                }*/

                     ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela.toCode());

            } else if (el.type === "cards") {
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela);
            } else if (el.type === "wrap") { // add blast and background here
                /*
  const ft = customOptions.filter(l => l.op === "gradient")[0];

                this.code.push(`new Wrapper().set({gradient: ${ft} }).add([
                    new Text("Hello").set({}),
                    new Text("Hello").set({}),
                    new Text("Hello").set({})
                ]) \n`);*/ // Go as alse objects

                 ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela.toCode()); //.join("") is important :)
                this.ready2Render.push(ela);

            } else if (el.type === "responsive") { // cdiv
                this.code.push(this.stor.complex.code);
            } else if (el.type === "free") {
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela.toCode()); //.join("") is important :)
                this.ready2Render.push(ela);
                ela = ela.render();
            } else if (el.type === "nav") { // protoNav
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela.toCode()); //.join("") is important :)
                this.ready2Render.push(ela);
                ela = ela.render();
            } // 20:20:26

            else if (el.type === "sideNav") {
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela.toCode()); //.join("") is important :)
                this.ready2Render.push(ela);
                ela = ela.render();
            } // 20:20:26

            else if (el.type === "dropdown") {
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });


                this.code.push(ela.toCode()); //.join("") is important :)
                this.ready2Render.push(ela);
                ela = ela.render();
            } /*else if (el.type == "code") {
                this.code.push(`new Code()
                    .set({
                        pad: [
                            { l: 30 },
                        ], 
                        mar: [
                            { a: 30 },
                        ], 
                        class: "language-js",
                        code: 'new Text("Modality").set({ font: "Arial" })'
                    })
                `);

            } */else {

                // keep this simpel else will work for everytign 
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                if (ela.toCode){
                    this.code.push(ela.toCode());
                } else {
                      this.code.push(ela);
                }
               //.join("") is important :)
                this.ready2Render.push(ela);
                ela = eval(ela).render();
            } // 20:20:26
        } // LARGE FOR I = 0 CYCLE END

        return this;
    }

    // `mount` is the selector every generated element renders into. It used
    // to be the hard-coded literal "#mount", so set({mount: "#other"}) was
    // silently ignored and a second Des rendered into the first one's mount.
    toTextArea(mount) {
        const target = mount || "#mount";
        let code = document.createElement("textarea");
        // It is necessary to have it to generate UI
        code.style.width = 300;
        code.style.height = 300; // both work 
        code.setAttribute("id", "elements");
        // ";\n\n", not "": each entry is a complete expression, and joining
        // them with nothing produced "})new Text(" — a syntax error, so the
        // generated code could not be pasted anywhere once a page had more
        // than one element.
        code.value = this.code.join(";\n\n");
        this.target = "#elements";

        let pre = document.createElement("pre");
        let codea = document.createElement("code");


        const prepare = this.code.map(c => `${c}.render("${target}"); \n \n`);
        this.code = prepare;
       
        codea.textContent = this.code;//.replaceAll(",.", ".").replaceAll(",, new", "new").replaceAll(/\[\s*\n*,\s*\n*/g, "["); // replace with your code
        pre.appendChild(codea);
        pre.setAttribute("class", "nonLayout");
        document.body.appendChild(pre); // append to the body or any other container
        document.body.appendChild(code);

        // Hold on to the nodes this instance created so set() can style them
        // directly instead of querying the page for the first #elements /
        // <pre> it finds, which could belong to the user's markup or to
        // another Des instance.
        this._codeEl = code;
        this._preEl = pre;
        return this;
    }

    /**
     * Shared fragments, referenced from E as `{ $ref: "name" }`.
     *
     * Ordinary data: one object, imported by every page's entry, so the
     * sharing is a plain import rather than a new authoring mode. Worth it
     * from two pages up — at one page a reference costs more than inlining,
     * which is why nothing here is automatic.
     *
     * MUST be called before `add`. `add` renders as it goes, so definitions
     * arriving afterwards are simply too late — and the failure was
     * "Unknown element type undefined" from deep in the mapper, which says
     * nothing about the real mistake. The wrong order is now refused where it
     * happens, in the words of the thing the caller did.
     */
    defs(map) {
        if (this._elements !== undefined) {
            throw new Error(
                '[nodality] .defs() must come before .add(): add() renders as it ' +
                'goes, so definitions given afterwards cannot be used. Chain it as ' +
                'new Des().defs({ ... }).nodes(N).add(E)');
        }
        this._defs = (map && typeof map === "object" && !Array.isArray(map)) ? map : {};
        return this;
    }

    set(obj) {
        // Emit-only mode: invoked from `nodality compile`. Capture the
        // imperative code array (the same content the `code: true` on-page
        // panel would show) and short-circuit before any DOM mutation /
        // eval / mount. The CLI reads __NODALITY_EMITTED__ to write the
        // companion file. This keeps the Designer purely a code generator
        // when run from the CLI — no rendering side effects.
        if (typeof globalThis !== "undefined" && globalThis.NODALITY_EMIT === true) {
            // Populate this.code without triggering DOM work.
            const prepare = this.code.map((c) => `${c}.render("${(obj && obj.mount) || "#mount"}")`);
            globalThis.__NODALITY_EMITTED__ = prepare;
            return this;
        }

        this.toTextArea(obj && obj.mount);

        this._codeEl.style.display = "none";
        this._preEl.style.display = "block";

        if (obj.elements === false) {
            this._preEl.style.display = "none";
        }

        if (obj.layout === false) {
            // document.querySelector("textarea").value = "";
            if (document.querySelector("#layoutPre") != null) {
                document.querySelector("#layoutPre").style.display = "none";
            }
        }

        if (obj.code === false){
             this._preEl.style.display = "none";
        }

        const layout = {
  Text, Image, Link, FlexRow, UINavBar, Free, Audio, Progress, Center, Code,
  Stack, Wrapper, MetaAdder, Table, Dropdown, Modal, TextField, Card,
  Wrap, FlexGrid, ZoomCard, Switcher, MobileBar, DesktopBar, SideNav, Spacer, HScroller, Polygon, Circle, UList
};

const formComponents = {
  FloatingInput, Range, RadioGroup, Picker, FilePickera,
  DataList, Base, Form, Button, Slider, Video, Checkbox,
};

const libs = {
  ElementMapper, Animator, LinkStyler, CardGen, AreaSwitcher,
};


const components = {
  ...layout,
  ...formComponents,
  ...libs,
};

        for (var i = 0; i < this.code.length; i++) {
            let sub = this.code[i];
            new Function(...Object.keys(components), sub)(...Object.values(components));
         //   eval(`${sub}`);
        }

        // Morph nodes run LAST, and they run here rather than in the
        // mapper because they need rendered geometry: a transition
        // interpolates a box, and both ends are measured from real
        // layout. Everything above only had descriptors.
        try {
            const host = document.querySelector((obj && obj.mount) || "#mount");
            this._morphs = applyMorphNodes(host, this._elements, this.protoOptions);
        } catch (e) {
            console.warn("[nodality] morph node skipped:", e);
        }

        // The agent surface runs after the morphs because it needs their
        // handles: a derived `navigate` calls the controller's own
        // `goToState`, so an agent's traversal is the user's traversal
        // and inherits every rule that path already enforces.
        //
        // Opt-in — absent `{ op: "agent-surface" }` this is a no-op, and
        // it must stay that way: turning a page's interaction structure
        // into callable tools is the page's decision, never the
        // framework's, and least of all a side effect of upgrading.
        try {
            this._agentSurface = installAgentSurface({
                mount: document.querySelector((obj && obj.mount) || "#mount"),
                elements: this._elements,
                nodes: this.protoOptions,
                morphs: this._morphs,
            });
        } catch (e) {
            console.warn("[nodality] agent surface skipped:", e);
        }

        // Stage 5. The round-trip needs the page to say what it was made
        // from: 13 of the 35 types render as a bare <div> with nothing to
        // tell them apart, so a parser reading the DOM alone would have to
        // guess which composite produced one — and the caller re-renders
        // whatever it is handed.
        //
        // Opt-in, and it must stay that way. This writes attributes into the
        // output, and every page that exists renders byte for byte as it
        // always did precisely because nobody asked for them.
        try {
            if (obj && obj.annotate) {
                annotateRoundTrip(
                    document.querySelector((obj && obj.mount) || "#mount"),
                    this._elements);
            }
        } catch (e) {
            console.warn("[nodality] round-trip annotation skipped:", e);
        }
    }
}


export {Des};