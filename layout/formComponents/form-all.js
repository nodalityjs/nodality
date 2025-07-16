import {Animator} from "./animator.js";

class Wrappera extends Base {
    constructor(){
	  super();
        this.state = {
            time: '',
            timeValid: false
        };
      document.querySelector("body").style.backgroundColor = "#c4cccf";
	}
    
render() {
let rg = new RadioGroup()
    .set({
        items: ["Male", "Female", "Third shit"],
        multiple: false,
        font: "Arial"
    })
    
    
let fp = new FilePickera()
.set({
    id: "A",
    title: "Add profile picture",
    background: "#3498DB",
    color: "white",
    font: "Arial",
    radius: "3rem"
})

let items = [["none", "select a car---"], ["tesla", "Tesla"], ["audi", "Audi"]];
    
let pc = new Picker()
.set({
    items: items,
    font: "Arial",
    arrayPadding: ({sides: ["all"], value: "0.5rem"}),
    rounded: true
})


    
let r = new Range().set({
    min: 100,
    max: 1000,
    step: 10,
   // plain: true,
    width: "80%",
    style: {
        trackColor: "#1abc9c",
        thumbColor: "#3498db"
    },
    arrayMargin: {sides: ["all"], value: "1rem"},
    font: "Arial"
});

   
let dataList = DataList()
            .set({
                placeholder: "Test",
                data:["Czech Republic", "Kongo", "Peru"],
                arrayMargin: {sides: ["all"], value: "1rem"}
            });
    
    
    let timeInput = new TextField().set({
         type: "text",
         placeholder: "Enter swimming time",
         arrayMargin: {sides: ["all"], value: "1rem"}
        });

        let floatTime = new FloatingInput()
        .set({
                title: "Your name",
                type: "input"
            });
    
    return Center().items([ 
        
        Text("Create an account")
        .fluid("S1")
        .font("Arial")
        .color("#3498db"),
        
        Text("Select your gender")
        .fluid("S3")
        .font("Arial"),
        
        rg,
        fp,
        
        floatTime,
		
        timeInput.onChange(current => {
            const regex = /^[0-5]?\d:[0-5]\d$/;
            let valid = regex.test(current);
            timeInput.setValid(valid, current);
            this.state.time = current;
            this.state.timeValid = valid;
        }),  
        
        dataList,
        pc,
        r,

        new Button("Submit")
                .set({
                    fluidc: "S6",
                    arrpad: {sides: ["all"], value: "1rem"},
                    arrayMargin: {sides: ["all"], value: "1rem"},
                    onTap: () => {

                       

                        if (!fp.hasFile){
                            fp.highlight(); // highlights file picker
                            alert("No file");
                        }

                        if (this.state.timeValid === false){
                            alert("Time is innvalid.");
                        }

                        
                        this.add({
                            a: this.state.time,
                            b: fp.file,
                            c: pc.el.options[pc.el.selectedIndex].value,
                            d: rg.getCheckedValues(),
                            e: r.value(),
                            g: dataList.getValue(),
                            h: floatTime.getValue()
                        });
                    },
                    color: "white",
                    background: "#3498db",
              
                }),
      
        new Text("By signing up, you agree with terms of use.")
           ]);
  }
    
    add(data){
        // perform sign up operations :D
        console.clear();
        console.log("Creating account with data:");
        console.log(data.a);
        console.log(data.b);
        console.log(data.c);
        console.log(data.d);
        console.log(data.e);
        console.log(data.g);
        console.log(data.h);
    }
}

new Wrappera().mount("#res");
window.Wrappera = Wrappera;
export { Wrappera };
