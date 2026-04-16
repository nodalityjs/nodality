import {Animator} from "./animator.js";


class Modal {
    constructor(){
        this.el = null;
        this.obj = null;
    }
    
    
    set(obj){
        let el = document.createElement("div");
        el.style.width = "100vw";
        el.style.height = "100vh";
        el.style.backgroundColor = obj.background;//"rgba(70,157,115,0.8)";
       // el.style.backgroundColor = "#3498db";
        el.style.zIndex = "1";
        //el.style.opacity = 0.90;
        el.style.position = "absolute";
        el.style.overflowY = "scroll";
      
       
        this.obj = obj;
        this.res = el;
        obj.close && this.close();
        return this;
    }
    
    
    
    
    close(){
        this.res.style.display = "none";
        return this;
    }
    
    show(){
         this.res.style.display = "block";
        return this;
    }
    
    
    
    add(els){
        
        
        
        
        let el = document.createElement("div");
        el.style.width = this.obj.width; 
        el.style.height = "auto";
        el.style.marginLeft = "auto";
        el.style.marginRight = "auto";
        el.style.backgroundColor = "white";


        let mq = window.matchMedia("(max-device-width: 415px)");
        if (mq.matches){
            el.style.marginTop = "200px";
             el.style.width = "100%";
        }

        
       /* el.style.marginTop = "60px";
        el.style.width = this.obj.width; //"60%";
        el.style.height = "auto";
        el.style.marginLeft = "auto";
        el.style.marginRight = "auto";
        el.style.backgroundColor = "white"; // "#3498db";
        el.style.opacity = 1.0;
        el.style.zIndex = "2";
        el.style.borderRadius = "16px";
        el.style.overflow = "hidden"; // User wrapper instead of this?
     */
     
     
        //  el.style.padding = "2em";
        
        
      /*  let mq = window.matchMedia("(max-device-width: 415px)");
        if (mq.matches){
            el.style.marginTop = "200px";
             el.style.width = "100%";
        }*/
            
        
       
        for (var i = 0; i < els.length; i++){
            console.log(els[i]);
            el.appendChild(els[i].render());
        }
        
        
        
        
          this.res.appendChild(el);
        
      /*  let inner = new Text("WOW");
       let ren = inner.render();
        ren.style.zIndex = "2";
        
        this.res.appendChild(ren);
        */
        
        
        
        return this;
        
    }
    
    
   
render(el) {
    if (el) {
        document.querySelector("body").style.margin = 0;
        document.querySelector("body").style.padding = 0;
        document.querySelector(el).appendChild(this.res);
    } else {
        return this.res;
    }
}
    
    
}





// var firstLong = "Mount Everest is Earth's highest mountain above sea level, located in the Mahalangur Himal sub-range of the Himalayas. The China–Nepal border runs across its summit point. Its elevation (snow height) of 8,848.86 m (29,031.7 ft) was most recently established in 2020 by the Nepali and Chinese authorities. Mount Everest attracts many climbers, including highly experienced mountaineers. There are two main climbing routes, one approaching the summit from the southeast in Nepal (known as the standard route) and the other from the north in Tibet. While not posing substantial technical climbing challenges on the standard route, Everest presents dangers such as altitude sickness, weather, and wind, as well as significant hazards from avalanches and the Khumbu Icefall. As of 2019, over 300 people have died on Everest, many of whose bodies remain on the mountain.";


// var secondLong = "Mount Everest (Chinese: 珠穆朗玛 Zhūmùlǎngmǎ; Nepali: सगरमाथा, romanized: Sagarmāthā; Tibetan: Chomolungma ཇོ་མོ་གླང་མ) is Earth's highest mountain above sea level, located in the Mahalangur Himal sub-range of the Himalayas. The China–Nepal border runs across its summit point. Its elevation (snow height) of 8,848.86 m (29,031.7 ft) was most recently established in 2020 by the Nepali and Chinese authorities. Mount Everest attracts many climbers, including highly experienced mountaineers. There are two main climbing routes, one approaching the summit from the southeast in Nepal (known as the standard route) and the other from the north in Tibet. While not posing substantial technical climbing challenges on the standard route, Everest presents dangers such as altitude sickness, weather, and wind, as well as significant hazards from avalanches and the Khumbu Icefall. As of 2019, over 300 people have died on Everest, many of whose bodies remain on the mountain. The first recorded efforts to reach Everest's summit were made by British mountaineers. As Nepal did not allow foreigners to enter the country at the time, the British made several attempts on the north ridge route from the Tibetan side. After the first reconnaissance expedition by the British in 1921 reached 7,000 m (22,970 ft) on the North Col, the 1922 expedition pushed the north ridge route up to 8,320 m (27,300 ft), marking the first time a human had climbed above 8,000 m (26,247 ft). The 1924 expedition resulted in one of the greatest mysteries on Everest to this day: George Mallory and Andrew Irvine made a final summit attempt on 8 June but never returned, sparking debate as to whether or not they were the first to reach the top. Tenzing Norgay and Edmund Hillary made the first official ascent of Everest in 1953, using the southeast ridge route. Norgay had reached 8,595 m (28,199 ft) the previous year as a member of the 1952 Swiss expedition. The Chinese mountaineering team of Wang Fuzhou, Gonpo, and Qu Yinhua made the first reported ascent of the peak from the north ridge on 25 May 1960.";








export { Modal };
