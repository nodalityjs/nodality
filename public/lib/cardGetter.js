class CardGen {

    static cards(el, cardOption, storage) {
        console.log("PP");
        console.log(storage);

        let childStrings = [];
        for (var o = 0; o < el.children.length; o++) {
            let child = el.children[o];

            if (child === "text") { // ChildStrings is mutated
               this.insertTextToCard(childStrings, cardOption, el, storage);
            }

            if (child === "image" && !el.backgroundCard){
                // alert("Text");
                 childStrings.push(`\n                       new Image("https://upload.wikimedia.org/wikipedia/commons/3/3a/Starship_S20.jpg").set({})`)
             }

             if (child === "link"){
                 // alert("Text");
                 if (cardOption.op){
                    childStrings.push(`\n ${storage.tabSpace(6)} ${storage.link[cardOption.op.theme.toLowerCase()].code}`);
                }  else {
                    childStrings.push(`\n ${storage.tabSpace(6)} ${storage.link["base"].code}`);
                }
                 
              
              }
        }
        return childStrings;
    }


    static insertTextToCard(childStrings, cardOption, el, storage){
        if (cardOption.op) {
            if (cardOption.op.ops && cardOption.op.ops.includes("text-blast")) {
                let inputString = `\n ${storage.tabSpace(6)} ${storage.text[cardOption.op.theme.toLowerCase()].code}`;
                let textToInsert = storage.ops[cardOption.op.theme.toLowerCase()].blast.code;

                if (!el.backgroundCard) {
                    textToInsert = storage.ops[cardOption.op.theme.toLowerCase()].blastFun(1);
                } 

                let result = this.insertTextBetween(inputString, textToInsert);
                childStrings.push(result);
            } else {
                childStrings.push(`\n ${storage.tabSpace(6)} ${storage.text[cardOption.op.theme.toLowerCase()].code}`);
            }
        } else {
            childStrings.push(`\n ${storage.tabSpace(6)} ${storage.text["base"].code}`);
        }
    }

   static insertTextBetween(inputString, textToInsert) {
      
       

            // Regular expression to match the pattern
        let regex = /(color: ".+?",)(.+?)(id: ".+?")/;
        
        // Find the index of the match
        let match = inputString.match(regex);
        if (match) {
           let index = match.index + match[0].length;
           
           // Insert the text at the found index
           let result = inputString.slice(0, index) + ', ' + textToInsert + ', ' + inputString.slice(index);
           console.log("RETA");
           console.log(result);
           return result;
        } else {
           // If no match is found, return the original string
           return inputString;
        }
    }
}


export {CardGen};
