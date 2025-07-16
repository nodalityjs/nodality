import {Animator} from "./animator.js";

class TopBar extends Base {
	constructor(){
		super();
	}

	render(){
		return FlexRow().items([
			Text("Newsroom"),
			Spacer(true),
			 Text("Contact us")
		]).arrayPadding(["left", "right"], "20px")
	}
}




new TopBar()
.mount("#res");



class NewsHeader extends Base {

	constructor(data){
		super();
		this.data = data;
	}
	
 render(){
	return new Group().items([
 Text(this.data.type)
	.fluidCopy("S6")
	.font("SF Pro Text")
	.bold()
	.margin("top", 40),
	
 Text(this.data.date)
	.color("gray")
	.font("Arial")
	.em(0.8)
	.margin("top", 10),
	
 Text(this.data.title)
	.font("Arial")
	.fluidCopy("S5")
	//.em(2.10)
	.bold()
	.margin("bottom", 10),

	Text(this.data.subtitle)
		.fluidCopy("S6")
		.font("Arial")
])
  .width("80%", "center");
  //.render("#res");
 }
}


new NewsHeader({
	title: "All-new iMac features stunning design in a spectrum of vibrant colors, the breakthrough M1 chip, and a brilliant 4.5K Retina display",
	subtitle: "iMac offers the best camera, mics, and speakers ever in a Mac, and Touch ID for the first time",
	date: "April 20th, 2021",
	type: "PRESS RELEASE"
}).mount("#res");





class ImageRow extends Base {
	constructor(){
		super();
	}
	
	render(){
		// can use Spacer()
return new FlexGrid(3).items([
	new Image("https://cdn3.iconfinder.com/data/icons/capsocial-round/500/facebook-512.png").RSize(30, 30, 1.4).padding(10),
	new Image("https://cdn3.iconfinder.com/data/icons/capsocial-round/500/facebook-512.png").RSize(30, 30, 1.4).padding(10),
	new Image("https://cdn3.iconfinder.com/data/icons/capsocial-round/500/facebook-512.png").RSize(30, 30, 1.4).padding(10),
])
.width("80%")
.center();
	}
}




new ImageRow()
.mount("#res");







class CenterRow extends Base {
	constructor(){
		super();
	}
	
	
	render(){
		
        
        
        
        
        
        

        
        
// 2 classes
// Wrap with no formatting options for custom Components
// Container() for all other elements
        
        
// return new Center()
return new Center().items([
	new Image("https://www.apple.com/newsroom/images/product/imac/standard/apple_new-imac-spring21_hero_04202021_Full-Bleed-Image.jpg.large_2x.jpg"),
	new Text("New MacBook Pro delivers up to 80% graphics performance and thinner bezels")
	.caption()
	.align("center")
	
])//.itemWidth("90%")
	}
}



new CenterRow().mount("#res");

/*------------------------HEADER------------------------
new Group().items([
new Text("PRESS RELEASE")
	.em(0.9)
	.color("red")
	.font("SF Pro Text")
	.bold()
	.margin("top", 40),
	
new Text("June 1, 2020")
	.color("gray")
	.font("Arial")
	.em(0.8)
	.margin("top", 10),
	
new Text("Apple announces MacBook Pro 14")
	.font("Arial")
	.em(2.10)
	.bold()
	.margin("bottom", 10)
])
  .width("80%", "center")
  .render("#res");*/

/*------------------------SOCIAL------------------------*/


/*------------------------IMAGE------------------------
new Center().items([
	new Image("https://www.apple.com/newsroom/images/product/mac/standard/Apple_macbookpro-13-inch_screen_05042020_big.jpg.medium_2x.jpg"),
	new Text("New MacBook Pro delivers up to 80% graphics performance and thinner bezels").caption().align("center")
	
]).itemWidth("90%")
  .render("#res")*/

/*------------------------HEADERS------------------------*/
new Center().items([
	new Text("Like Apple.").font("SF Pro Display").bold().em(6),
	new Text("Big bold font.").font("SF Pro Display").bold().em(2)
]).margin("top", 40)
  .margin("bottom", 40)
  .itemWidth("80%")
  .render("#res");

/*------------------------TEXT------------------------*/
new Text("Cupertino, California — Apple today updated the 13-inch MacBook Pro with the new Magic Keyboard for the best typing experience ever on a Mac notebook and doubled the storage across all standard configurations, delivering even more value to the most popular MacBook Pro. The new lineup also offers 10th-generation processors for up to 80 percent faster graphics performance1 and makes 16GB of faster 3733MHz memory standard on select configurations. With powerful quad-core processors, the brilliant 13-inch Retina display, Touch Bar and Touch ID, immersive stereo speakers, all-day battery life, and the power of macOS, all in an incredibly portable design, the new 13-inch MacBook Pro is available to order today, starting at $1,299, and $1,199 for education.")
.em(1)
/*.margin("top", 20)
.margin("bottom", 30)*/

.arrayPadding(["top", "bottom"], 40)
.width("80%", "center")
/*.sizes([
			{w: 800, size: 1.2},
			{w: 900, size: 1.34},
			{mobile: 4}
		])*/
.render("#res");




new Center()
.items([
	/*new Progress(0.80)
	.size("80%", 20)
	.colors("#ecf0f3", "#3498db")
    .round(23),*/
	
	new Text("80% faster graphics performance.")
	.align("center")
	.font("SF Pro Display")
	.color("gray")
	.padding("top", 10)
	.bold()
	
]).itemWidth("80%")
.arrayPadding(["top", "bottom"], 30)
 .render("#res");



let cards = [
	new Card().items([
		new Spacer(true),
		new Text("Fast")
            .bold()
            .em(2),
		//.large().bold(),//.padding(20, 20, 0, 3),
		new Spacer(true),
		new Text("The 13-inch MacBook Pro includes a solid-state drive that’s blazing fast, with sequential read speeds up to 3.0GB/s.10 The standard configurations have twice the capacity of the previous generation (256GB, 512GB, or 1TB), and with up to 4TB of storage, you can take all your photos and videos with you no matter where you go. And with the Apple T2 Security Chip, everything is automatically encrypted on the fly.").padding(20),
        
       
    
        
        
        Image("https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MBP13GT-201807?wid=1200&hei=630&fmt=jpeg&qlt=95&op_usm=0.5,0.5&.v=1531249596119", "exact")
		
		//new ExactImage("https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MBP13GT-201807?wid=1200&hei=630&fmt=jpeg&qlt=95&op_usm=0.5,0.5&.v=1531249596119")
	])
	.shadow(),
	
new Card().items([
		new Spacer(),
		new Text("Efficient")
            .bold()
            .em(2),
		//.large().bold().padding(20, 20, 0, 3),
		new Spacer(),
		new Text("The 13-inch MacBook Pro includes a solid-state drive that’s blazing fast, with sequential read speeds up to 3.0GB/s.10 The standard configurations have twice the capacity of the previous generation (256GB, 512GB, or 1TB), and with up to 4TB of storage, you can take all your photos and videos with you no matter where you go. And with the Apple T2 Security Chip, everything is automatically encrypted on the fly.").padding(20),
		
		Image("https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MBP13GT-201807?wid=1200&hei=630&fmt=jpeg&qlt=95&op_usm=0.5,0.5&.v=1531249596119", "exact")
	])
	.shadow(),
	
	new Card().items([
		new Spacer(),
		new Text("Durable")
            .bold()
            .em(2),
		//.large().bold().padding(20, 20, 0, 3),
		new Spacer(),
		new Text("The 13-inch MacBook Pro includes a solid-state drive that’s blazing fast, with sequential read speeds up to 3.0GB/s.10 The standard configurations have twice the capacity of the previous generation (256GB, 512GB, or 1TB), and with up to 4TB of storage, you can take all your photos and videos with you no matter where you go. And with the Apple T2 Security Chip, everything is automatically encrypted on the fly.").padding(20),
		
		Image("https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MBP13GT-201807?wid=1200&hei=630&fmt=jpeg&qlt=95&op_usm=0.5,0.5&.v=1531249596119", "exact")
	])
	.shadow(),	
];

	new Grid(3)
		.items(cards)
		.center()
		.gap(20)
		.setColumns(1, 600)
		.padding(20)
		.render("#res");


new Footer("2020").font("Arial").render("#res");
window.TopBar
NewsHeader
ImageRow
CenterRow = TopBar
NewsHeader
ImageRow
CenterRow;
export { TopBar
NewsHeader
ImageRow
CenterRow };
