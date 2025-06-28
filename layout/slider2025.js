import {Animator} from "./animator.js";
import {Button} from "./button.js";

class Slider {
    constructor(elements, buttons) {
      this.container = document.createElement("div");//document.querySelector(containerSelector);
      this.elements = elements;
      this.currentSlideIndex = 0;
  
      this.buttons = buttons;
  
      if (!this.buttons){
  
  let buttons = { 
      leftButton: new Button("L").set({
              url: "https://static-00.iconduck.com/assets.00/circle-arrow-left-icon-512x512-xp8okg5c.png",
              color: "#1abc9c",
              frame: {width: 50, height: 50},
              radius: "100%",
              arrayMargin: {sides: ["all"], value: "1rem"}
              // 10/01/2025 18:12:55 margin does not add to page width, padding does
          }),
  
          rightButton: new Button("R").set({
              url: "https://static-00.iconduck.com/assets.00/arrow-right-circle-icon-2048x2048-m0qcnetg.png",
              color: "#1abc9c",
              frame: {width: 50, height: 50},
              radius: "100%",
              arrayMargin: {sides: ["all"], value: "1rem"}
          })
        };
  
        this.buttons = buttons;
      } 
  
      this.createSlider();
      this.init();
    }
  
    toCode(){
        let code = `new Slider([${this.elements.map(el => el.toCode())}], null)`;
        code = code.replace(/,\s*\./g, '.');
		return [code];
    }

    createSlider() {
      // Slider container
      this.slider = document.createElement('div');
      this.slider.style.width = '100%';
      this.slider.style.height = '400px';
      this.slider.style.margin = '20px auto';
      this.slider.style.textAlign = 'center';
      this.slider.style.borderRadius = '20px';
      this.slider.style.overflow = 'hidden';
      this.slider.style.position = 'relative';
  
      // Slides wrapper
      const slidesWrapper = document.createElement('div');
      this.slidesWrapper = slidesWrapper;
      slidesWrapper.style.display = 'flex';
      slidesWrapper.style.overflowX = 'scroll';
      slidesWrapper.style.scrollBehavior = 'smooth';
      slidesWrapper.style.scrollSnapType = 'x mandatory';
  
      this.elements.forEach((text, index) => {
        const slide = document.createElement('div');
        slide.setAttribute("class", "slide");
        slide.style.display = 'flex';
        slide.style.justifyContent = 'center';
        slide.style.alignItems = 'center';
        slide.style.flexShrink = '0';
        slide.style.width = '100%';
        slide.style.height = '400px';
        slide.style.background = index % 2 === 0 ? 'rgb(250, 246, 212)' : 'white';
        slide.style.transformOrigin = 'center center';
        slide.style.transform = 'scale(1)';
        slide.style.scrollSnapAlign = 'center';
  
        slide.appendChild(text.render());
        slidesWrapper.appendChild(slide);
      });
  
      // Navigation arrows
      this.arrowPrev = this.buttons.leftButton.render();
      this.arrowPrev.style.position = 'absolute';
      this.arrowPrev.style.left = '10px';
      this.arrowPrev.style.top = '50%';
      this.arrowPrev.style.transform = 'translateY(-50%)';
      this.arrowPrev.style.zIndex = '1';
  
      this.arrowNext = this.buttons.rightButton.render();
      this.arrowNext.style.position = 'absolute';
      this.arrowNext.style.right = '10px';
      this.arrowNext.style.top = '50%';
      this.arrowNext.style.transform = 'translateY(-50%)';
      this.arrowNext.style.zIndex = '1';
  
      // Navigation dots
      const nav = document.createElement('div');
      nav.style.position = 'absolute';
      nav.style.bottom = '10%';
      nav.style.left = '50%';
      nav.style.width = '200px';
      nav.style.transform = 'translateX(-50%)';
      nav.style.textAlign = 'center';
  
      this.elements.forEach((_, index) => {
        const navLink = document.createElement('a');
        navLink.style.display = 'inline-block';
        navLink.style.height = '15px';
        navLink.style.width = '15px';
        navLink.style.borderRadius = '50%';
        navLink.style.backgroundColor = 'black';
        navLink.style.margin = '0 10px';
        navLink.style.cursor = 'pointer';
        navLink.dataset.index = index;
        nav.appendChild(navLink);
      });
  
      // Append elements to the slider
      this.slider.appendChild(this.arrowPrev);
      this.slider.appendChild(this.arrowNext);
      this.slider.appendChild(slidesWrapper);
      this.slider.appendChild(nav);
  
      // Append slider to the container
      this.container.appendChild(this.slider);
  
      // Store references
      this.slidesWrapper = slidesWrapper;
      this.navLinks = nav.querySelectorAll('a');
    }
  
    init() {
      this.updateActiveSlide();
      this.attachEventListeners();
    }
  
    attachEventListeners() {
      this.arrowPrev.addEventListener('click', () => {
        this.moveToSlide(
          this.currentSlideIndex - 1 < 0 ? this.elements.length - 1 : this.currentSlideIndex - 1
        );
      });
  
      this.arrowNext.addEventListener('click', () => {
        this.moveToSlide((this.currentSlideIndex + 1) % this.elements.length);
      });
  
      this.navLinks.forEach((navLink) => {
        navLink.addEventListener('click', (e) => {
          e.preventDefault();
          const index = parseInt(navLink.dataset.index, 10);
          this.moveToSlide(index);
        });
      });
  
       // Keydown event for left and right arrow keys
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        // Move to the previous slide
        this.moveToSlide(
          this.currentSlideIndex - 1 < 0 ? this.elements.length - 1 : this.currentSlideIndex - 1
        );
      } else if (e.key === 'ArrowRight') {
        // Move to the next slide
        this.moveToSlide((this.currentSlideIndex + 1) % this.elements.length);
      }
    });
    }
  
    moveToSlide(index) {
      this.currentSlideIndex = index;
      this.updateActiveSlide();
    }
  
    updateActiveSlide() {
      this.navLinks.forEach((navLink, index) => {
        navLink.style.backgroundColor = index === this.currentSlideIndex ? 'green' : 'gray';
      });
  
      const slideWidth = this.slidesWrapper.querySelector('.slide').offsetWidth;
      this.slidesWrapper.scrollTo({
        left: this.currentSlideIndex * slideWidth,
        behavior: 'smooth',
      });
    }
  
    render(div) {
      if (div) {
        document.querySelector(div).appendChild(this.slider);
      } else {
        return this.slider;
      }
    }
  }
   
export { Slider };
