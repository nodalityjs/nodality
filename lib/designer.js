/* Classes:
ElementMapper
*/

// NEXT STEPS = FreeLayout
import {ElementMapper} from "../lib/elementMapper.js";
import {Animator} from "../layout/animator.js";
import {Text} from "../layout/text.js";
import {Image} from "../layout/image.js";
import {Link} from "../layout/link.js";
import {FlexRow} from "../layout/flexRow.js"; // Yes! 00:50:30 14/04 add them all here
import { UINavBar } from "../layout/newNavBar.js";
import { Free } from "../layout/free.js";
import { Audio } from "../layout/audionew.js";
import { Progress } from "../layout/progress.js";
import { Center } from "../layout/center.js";
import { Code } from "../layout/code.js";
//import { Link } from "../layout/link.js";
import { Stack } from "../layout/stack.js";
import { Wrapper } from "../layout/container.js";
import { MetaAdder } from "../layout/metaAdder.js";
import { Table } from "../layout/table.js";
import { Dropdown } from "../layout/dropdown2025.js";
import { Modal } from "../layout/modal2025.js";
import { TextField } from "../layout/textField.js";
import { Card } from "../layout/flexCard.js";
//import { NavBar } from "../layout/navBar.js";
import { Wrap } from "../layout/wrap.js";
import { FlexGrid } from "../layout/flexGrid.js";
import { ZoomCard } from "../layout/zoomCard.js";
import { /*Multi*/Switcher } from "../layout/multiswitcher.js";
import { /*Beta*/MobileBar } from "../layout/betaMobileBar.js";
import { /*Beta*/DesktopBar } from "../layout/betaDesktopBar.js";
import { SideNav } from "../layout/sideNavBar.js";
import { Spacer } from "../layout/spacer.js";


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
import { Video } from "../layout/video.js";
import { Checkbox } from "../layout/checkbox.js";
import { LinkStyler } from "../lib/linkGetter.js";
import { CardGen } from "../lib/cardGetter.js";
import {Simple} from "../layout/gridSwitcher.js";

// ANIM
import {KeyframeAnim} from "../lib/appleAnim.js";
import {TransformAnim} from "../lib/transformanim.js";
import {Stacker} from "../lib/stacker.js";
import {ScrollVideo} from "../lib/scrollvideo.js";

// Audio, progress, TextField, import navFactor
class Des {
    constructor() {
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
                code: `new Link("Link").set({text: "Hello", url: "#a", background: "", color: "orange", hover: {color: "white", background: "orange", animation: 0.6}, borderObj: {color: "orange", width: "3px", radius: "0.7rem"}, pad: { sides: ["all"], value: "0.6rem" }, arrayMargin: { sides: ["top", "bottom"], value: "0.8rem" }, radius: "0.4rem"})`,
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
            code: ` new Simple()
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
        
        
     
    

    at(opts) {
        this.options.push(opts);
        return this;
    }

    nodes(arr) {
        this.options = arr;
        this.protoOptions = [...arr];
        console.log(this.options);
        console.log(this.protoOptions);
        return this;
    }

    getElType(type) {
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

        this.css = [];
        this.elCSS = [];
        this.elHTML = [];

        let customOptions = this.options;
        //console.log("COO");
        //console.log(customOptions);
        for (var i = 0; i < arr.length; i++) {
            let el = arr[i];
            let ela = null;

            let ops = ["blast", "gradient", "shadow", "filter", "animationSimple", "transform"];
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
                        gradient: "linear-gradient(orange, green)"
                    },

                },

                {

                    op: {
                        name: "shadow",
                        color: "#1abc9c",
                        steps: 3
                    },
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
                            "rotate(30deg)",
                            "skew(40deg, 0deg)",
                            "perspective(500px)",
                            "matrix(1, 0, 0, 1, 50, 50)"
                        ],
                    }
                }
            ];

            /*console.log("OPS");
            console.log(ops);
            
            console.log("CUSTOM OPTIONS");
            console.log(customOptions);
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
                       
                        let as = replacementObjects[q];
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
                        }
                      
                        customOptions[index] = as;
                    }
                }
            }

            console.warn(customOptions);



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
                            "ty:-20px",
                            "scale(3)",
                            "rotate(30deg)",
                            "skew(40deg, 0deg)",
                            "perspective(500px)",
                            "matrix(1, 0, 0, 1, 50, 50)"
                        ];
                    }

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
                    } 


if (q == i){ // 23:07.20 Nice!!!! 23:04 bef

console.log("DURA");
console.log(duration);

                    customOptions[q].op.transform = {
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

                    console.log("COQ");
                    console.log(customOptions[q].op.values);
                    if (customOptions[q]?.op.values){

                 //   alert("P")

                    let values = "values";

                    if (customOptions[q]?.op.values) {
                        delete customOptions[q].op[values]; // remove in both logs, weird
                    }
                }

                   

                    
                }
                



                }
            } // for q = cycle end

            console.log(`----------------------------LLL ${i} ${customOptions.length}`);
           

            const matchEls = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(el.type) || el.type === "img" || el.type === "a" || /*el.type == "modal" ||*/ el.type == "slider" /*|| el.type == "table"*/;
           
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
 this.code.push(`
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
    `);
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
                import {Modal} from "../layout/modal2025.js";
                import {Stack} from "../layout/stack.js";
                import {Image} from "../layout/image.js";
                import {FlexRow} from "../layout/flexrow.js";
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

                if (el.child === "img") {
                    this.code.push(this.stor.flexRow(el.colat).image.code);
                } else {
                    this.code.push(this.stor.flexRow(el.colat).text.code);
                }

            } else if (el.type === "cards") {
                console.log("STORO");
                console.log(this.stor);
                ela = ElementMapper.mapType({
                    el: el,
                    customOptions: customOptions,
                    i: i,
                    storage: this.stor
                });

                this.code.push(ela);
            } else if (el.type === "wrap") {
                this.code.push(`new Wrapper().set({}).add([
                    new Text("Hello").set({}),
                    new Text("Hello").set({}),
                    new Text("Hello").set({})
                ]) \n`);

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
            } else if (el.type == "code") {
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

            } else {

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

    toTextArea() {
        let code = document.createElement("textarea");
        // It is necessary to have it to generate UI
        code.style.width = 300;
        code.style.height = 300; // both work 
        code.setAttribute("id", "elements");
        code.value = this.code.join("");
        this.target = "#elements";

        let pre = document.createElement("pre");
        let codea = document.createElement("code");


        const prepare = this.code.map(c => `${c}.render("#mount"); \n \n`);
        this.code = prepare;
       
        codea.textContent = this.code;//.replaceAll(",.", ".").replaceAll(",, new", "new").replaceAll(/\[\s*\n*,\s*\n*/g, "["); // replace with your code
        pre.appendChild(codea);
        pre.setAttribute("class", "nonLayout");
        document.body.appendChild(pre); // append to the body or any other container
        document.body.appendChild(code);

        let preo = document.createElement("pre");
        preo.style.marginTop = "100px";
        preo.style.overflow = "scroll";
        return this;
    }

    set(obj) {
        this.toTextArea();

        document.querySelector("#elements").style.display = "none";
        document.querySelector("pre").style.display = "block";

        if (obj.elements === false) {
            document.querySelector(".nonLayout").style.display = "none";
        }

        if (obj.layout === false) {
            // document.querySelector("textarea").value = "";
            if (document.querySelector("#layoutPre") != null) {
                document.querySelector("#layoutPre").style.display = "none";
            }
        }

        const layout = {
  Text, Image, Link, FlexRow, UINavBar, Free, Audio, Progress, Center, Code,
  Stack, Wrapper, MetaAdder, Table, Dropdown, Modal, TextField, Card,
  Wrap, FlexGrid, ZoomCard, Switcher, MobileBar, DesktopBar, SideNav, Spacer,
};

const formComponents = {
  FloatingInput, Range, RadioGroup, Picker, FilePickera,
  DataList, Base, Form, Button, Slider, Video, Checkbox,
};

const libs = {
  ElementMapper, Animator, LinkStyler, CardGen, Simple,
};


const components = {
  ...layout,
  ...formComponents,
  ...libs,
};

        for (var i = 0; i < this.code.length; i++) {
            let sub = this.code[i];
            console.log("SUBO");
            console.log(sub);
            new Function(...Object.keys(components), sub)(...Object.values(components));
         //   eval(`${sub}`);
        }
    }
}


export {Des};