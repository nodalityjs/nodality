/*!
 * nodality v1.0.32
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
import {Button} from "./button.js";

class Slider {
  constructor(elements, buttons) {
    this.container = document.createElement("div"); // root element
    this.container.style.width = "100%";
    this.container.style.margin = "20px auto";
    this.container.style.textAlign = "center";

    this.elements = elements;
    this.currentSlideIndex = 0;

    this.buttons = buttons;

    if (!this.buttons) {
      let buttons = {
        leftButton: new Button("L").set({
        frame: { width: 50, height: 50 },
        //  url: "../assets/arrow-left.png",
        svg: this.createArrowSVG("left", 28),
          color: "#1abc9c",
         // image: new Image().set({ url: "../assets/arrow-left.png", width: "50px", height: "50px" }),
          radius: "100%",
          arrayMargin: { sides: ["all"], value: "1rem" },
        }),

        rightButton: new Button("R").set({
          frame: { width: 50, height: 50 },
          svg: this.createArrowSVG("right", 28),
         // url: "../assets/arrow-right.png",
          color: "#1abc9c",
          radius: "100%",
          arrayMargin: { sides: ["all"], value: "1rem" },
        }),
      };
      this.buttons = buttons;
    }

    this.createSlider();
    this.init();
  }

   createArrowSVG(direction = 'left', size = 28) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "block"; // avoid inline-gap issues
  svg.style.pointerEvents = "none"; // prevent internal svg catching pointer

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("fill", "currentColor");

  if (direction === "left") {
    // chevron-left path
    path.setAttribute("d", "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z");
  } else {
    // chevron-right path
    path.setAttribute("d", "M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z");
  }

  svg.appendChild(path);
  return svg;
}

  toCode() {
    let code = `new Slider([${this.elements.map((el) => el.toCode())}], null)`;
    code = code.replace(/,\s*\./g, ".");
    return [code];
  }

  createSlider() {
    // Slider frame
    this.slider = document.createElement("div");
    this.slider.style.width = "100%";
    this.slider.style.height = "400px";
    this.slider.style.borderRadius = "20px";
    this.slider.style.overflow = "hidden";
    this.slider.style.position = "relative";
    this.slider.style.marginBottom = "15px";

    // Slides wrapper
    const slidesWrapper = document.createElement("div");
    this.slidesWrapper = slidesWrapper;
    slidesWrapper.style.display = "flex";
    slidesWrapper.style.overflowX = "scroll";
    slidesWrapper.style.scrollBehavior = "smooth";
    slidesWrapper.style.scrollSnapType = "x mandatory";

    // build slides
    this.elements.forEach((text, index) => {
      const slide = document.createElement("div");
      slide.setAttribute("class", "slide");
      slide.style.display = "flex";
      slide.style.justifyContent = "center";
      slide.style.alignItems = "center";
      slide.style.flexShrink = "0";
      slide.style.width = "100%";
      slide.style.height = "400px";
      slide.style.background = index % 2 === 0 ? "rgb(250, 246, 212)" : "white";
      slide.style.transformOrigin = "center center";
      slide.style.transform = "scale(1)";
      slide.style.scrollSnapAlign = "center";

      // render element once and clone from that instance for the thumbnail
      const rendered = text.render();
      slide.appendChild(rendered);
      slidesWrapper.appendChild(slide);
    });

    // Navigation arrows
    this.arrowPrev = this.buttons.leftButton.render();
    this.arrowPrev.style.position = "absolute";
    this.arrowPrev.style.left = "10px";
    this.arrowPrev.style.top = "50%";
    this.arrowPrev.style.transform = "translateY(-50%)";
    this.arrowPrev.style.zIndex = "1";

    this.arrowNext = this.buttons.rightButton.render();
    this.arrowNext.style.position = "absolute";
    this.arrowNext.style.right = "10px";
    this.arrowNext.style.top = "50%";
    this.arrowNext.style.transform = "translateY(-50%)";
    this.arrowNext.style.zIndex = "1";

    // Navigation dots
    const nav = document.createElement("div");
    nav.style.position = "absolute";
    nav.style.bottom = "10%";
    nav.style.left = "50%";
    //nav.style.width = "200px";
    nav.style.transform = "translateX(-50%)";
    nav.style.textAlign = "center";

    this.elements.forEach((_, index) => {
      const navLink = document.createElement("a");
      navLink.style.display = "inline-block";
      navLink.style.height = "15px";
      navLink.style.width = "15px";
      navLink.style.borderRadius = "50%";
      navLink.style.backgroundColor = "black";
      navLink.style.margin = "0 10px";
      navLink.style.cursor = "pointer";
      navLink.dataset.index = index;
      nav.appendChild(navLink);
    });

    // ✅ Thumbnails section (fixed and robust)
    const thumbsContainer = document.createElement("div");
    thumbsContainer.style.display = "flex";
    thumbsContainer.style.justifyContent = "flex-start";
    thumbsContainer.style.marginTop = "10px";
    thumbsContainer.style.gap = "10px";
    thumbsContainer.style.flexWrap = "nowrap";
    thumbsContainer.style.overflowX = "auto"; // optional: allow scrolling if many thumbs

    // create thumbnails from existing slide DOM (clone once)
    const slides = slidesWrapper.querySelectorAll(".slide");
    slides.forEach((slide, index) => {
      const thumb = document.createElement("div");
      thumb.className = "slider-thumb"; // specific class so we only select top-level thumbs
      thumb.dataset.index = index.toString();
      thumb.style.width = "60px";
      thumb.style.height = "40px";
      thumb.style.border = "2px solid gray";
      thumb.style.borderRadius = "5px";
      thumb.style.overflow = "hidden";
      thumb.style.cursor = "pointer";
      thumb.style.flexShrink = "0";
      thumb.style.position = "relative";

      // use the slide's rendered content and clone it (no extra text.render() calls)
      const sourceContent = slide.firstElementChild || slide.cloneNode(true);
      const preview = sourceContent.cloneNode(true);

      // scale down the preview and make sure it sits in the thumb
      preview.style.transform = "scale(0.2)";
      preview.style.transformOrigin = "top left";
      // make width/height big enough so scale produces visible result
      preview.style.width = "300px";
      preview.style.height = "auto";
      preview.style.pointerEvents = "none"; // prevent interactive elements inside preview catching clicks

      thumb.appendChild(preview);

      thumbsContainer.appendChild(thumb);
    });

    // Append elements to the slider
    this.slider.appendChild(this.arrowPrev);
    this.slider.appendChild(this.arrowNext);
    this.slider.appendChild(slidesWrapper);
    this.slider.appendChild(nav);

    // Append everything to root container (single root element)
    this.container.appendChild(this.slider);
    this.container.appendChild(thumbsContainer);

    // Store references (select only top-level thumbs)
    this.slidesWrapper = slidesWrapper;
    this.navLinks = Array.from(nav.querySelectorAll("a"));
    this.thumbs = Array.from(thumbsContainer.querySelectorAll(".slider-thumb"));
  }

  init() {
    this.updateActiveSlide();
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.arrowPrev.addEventListener("click", () => {
      this.moveToSlide(this.currentSlideIndex - 1 < 0 ? this.elements.length - 1 : this.currentSlideIndex - 1);
    });

    this.arrowNext.addEventListener("click", () => {
      this.moveToSlide((this.currentSlideIndex + 1) % this.elements.length);
    });

    this.navLinks.forEach((navLink) => {
      navLink.addEventListener("click", (e) => {
        e.preventDefault();
        const index = parseInt(navLink.dataset.index, 10);
        this.moveToSlide(index);
      });
    });

    // thumbnails click (use data-index to be robust)
    this.thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const idx = parseInt(thumb.dataset.index, 10);
        this.moveToSlide(idx);
      });
    });

    // Keydown event for left and right arrow keys
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        this.moveToSlide(this.currentSlideIndex - 1 < 0 ? this.elements.length - 1 : this.currentSlideIndex - 1);
      } else if (e.key === "ArrowRight") {
        this.moveToSlide((this.currentSlideIndex + 1) % this.elements.length);
      }
    });
  }

  moveToSlide(index) {
    this.currentSlideIndex = index;
    this.updateActiveSlide();
  }

  updateActiveSlide() {
    // highlight nav dots using dataset (robust even if nodes reorder)
    this.navLinks.forEach((navLink) => {
      const idx = parseInt(navLink.dataset.index, 10);
      navLink.style.backgroundColor = idx === this.currentSlideIndex ? "green" : "gray";
    });

    // highlight thumbs using dataset (robust)
    this.thumbs.forEach((thumb) => {
      const idx = parseInt(thumb.dataset.index, 10);
      thumb.style.borderColor = idx === this.currentSlideIndex ? "green" : "gray";
    });

    // scroll main slides wrapper
    const slideElem = this.slidesWrapper.querySelector(".slide");
    const slideWidth = slideElem ? slideElem.offsetWidth : this.slidesWrapper.clientWidth;
    this.slidesWrapper.scrollTo({
      left: this.currentSlideIndex * slideWidth,
      behavior: "smooth",
    });
  }

  render(div) {
    if (div) {
      document.querySelector(div).appendChild(this.container);
    } else {
      return this.container; // return single root element
    }
  }
}

export { Slider };



/*

new Slider(texts, /*{

    leftButton: new Button("").set({
        url: "true",
        img: new Image().set({
            url: "../assets/arrow-left.png",
            width: "50px",
            height: "50px"
        }),
        color: "#1abc9c",
        radius: "100%",
        mar: {
            "a":40
        }
    }),

    rightButton: new Button("").set({
        url: "true",
        img: new Image().set({
            url: "../assets/arrow-right.png",
            width: "50px",
            height: "50px"
        }),
        color: "#1abc9c",
        frame: {
            width: 50,
            height: 50
        },
        radius: "100%",
        mar: {
            "a":40
        }
    })

}, null)
*/
