import {Animator} from "./animator.js";

 
class HScroller {
    constructor() {
        this.setupa();
       // this.seto();
      
    }

    seto(obj){
        this.e = obj.a;

        obj.speed && (this.divisor = obj.speed);
        return this;
    }

    setupa(){
        this.parallaxIDs(["#rta"]);
        this.divisor(1.0);
        return this;
    }

    add(items){
        this.items = items;
        this.setup();
        return this;
    }


    parallaxIDs(ids){
        this.parallaxIDs = ids;
        return this;
    }

    divisor(divi){
        this.divisor = divi;
        return this;
    }

    setup() {

        
     //  alert(this.e);

  

        this.pts = 0;

        let wrap = document.createElement("div");
        wrap.style.width = "100%";
        wrap.style.height = "100%";

        let div = document.createElement("div");//document.querySelector("div");
        div.style.display = "flex";
        div.style.width = "100%";

       

        for (var i = 0; i < this.items.length; i++) {
            let t = this.items[i].render(); /* new Text("Hello")
                .set({
                    fluidc: "S1",
                    background: "orange",
                    font: "Arial"
                }).render();*/
            div.appendChild(t);
        }

        wrap.appendChild(div);

        let pts = window.localStorage.getItem("pts");
        if (pts !== null){
            this.pts = pts;
        } // 16:36:39 10/03/24

        wrap.addEventListener("wheel", (event) => {
           // console.log("SL" + event.deltaY);
           // console.log("SLA" + event.scrollLeft);

           
            if (event.deltaY < 0) {
                console.log('Scrolling up');
                this.pts--;
            } else if (event.deltaY > 0) {
                console.log('Scrolling down');
                this.pts++;
            }

            window.localStorage.setItem("pts", this.pts);
            event.preventDefault();
  
            for (var i = 0; i < div.childNodes.length; i++) {
                console.log(div.childNodes[i].toString().substr(7));

                let child = div.childNodes[i];

                let parallax = this.parallaxIDs;  //["#rta"];
                if (parallax.includes(child.id)){
                    child.style.transform = `translateX(${this.pts / this.divisor}%)`; 
                }
            }

            div.style.transform = `translateX(${this.pts / this.divisor}%)`;
            window.localStorage.setItem("translation", this.pts / this.divisor);
           

        });

        let t = window.localStorage.getItem("translation");
        if (t !== null){
            div.style.transform = `translateX(${t}%)`;
        }

        // Make this vertical on mobile, scrolling won't work
        // Simple CSS rule
        // Don't complicate too much
        this.div = wrap;
    }

    render(div) {
		if (div) {
			document.querySelector(div).appendChild(this.div);
		} else {
			return this.div;
		}

       // document.body.appendChild(this.div);
    }
}

/*  new T()
.parallaxIDs(["#rta"])
.divisor(2.2)
.add([

// Nest more views
    new Text("Sail")
        .set({
            color: "#1abc9c",
            fluidc: "S1",
            font: "Arial",
            stroke: {range:["0px","3000px"],op:{name:"blast",color:"#1abc9c",width:"3px"}}
        }),

        new Text("Wave").set({
            em: 10,
            font: "Arial",
            weight: "bold",
            zIndex: -1,
            absolute: true,
            stroke: {range:["0px","3000px"],op:{name:"blast",color:"#a1dae330",width:"3px"}},
            opacity: 0.6
        }),
       
        new Text("the")
        .set({
            color: "#1abc9c",
            fluidc: "S1",
          //  background: "orange",
            font: "Arial",
            arrayMargin: {sides: ["top"], value: "3rem"},
            stroke: {range:["0px","3000px"],op:{name:"blast",color:"#1abc9c",width:"3px"}}
        }),

        new Image("https://media.cnn.com/api/v1/images/stellar/prod/ap24002766263400.jpg?c=original")
        .set({
           width: "400px",
           height: "100%",
           arrayMargin: {sides: ["left", "bottom"], value: "-1.7rem"},
           arrpad: {sides: ["top"], value: "3rem"},
           opacity: 0.7,
           zIndex: -1,
           id: "#rta"
        }), 


    new Wrapper().set({}).add([
        new Text("Seven seas")
            .set({
                fluidc: "S1",
                color: "#1abc9c",
                font: "Arial"
            }),

        new Text("This is wonderful offer")
    ]),
      

        new Text("Welcome")
        .set({
            fluidc: "S1",
          //  background: "orange",
            font: "Arial"
        }),

        new Text("onboard")
        .set({
            fluidc: "S1",
          // background: "orange",
            font: "Arial"
        }),

        new Wrapper().set({}).add([
        new Text("Get in touch.")
            .set({
                fluidc: "S1",
             //   background: "orange",
                font: "Arial"
            }),

        new Image("https://media.cnn.com/api/v1/images/stellar/prod/ap24002766263400.jpg?c=original")
            .set({
                width: "400px",
                opacity: 0.7,
                zIndex: -1
            }),
    ]),
])
.render();
*/
export { HScroller };
