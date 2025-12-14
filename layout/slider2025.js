/*!
 * nodality v1.0.90
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";
import { Button } from "./button.js";

class Slider {
  constructor(elements, buttons, options = {}) {
    this.container = document.createElement("div");
    this.container.style.width = "100%";
    this.container.style.margin = "20px auto";
    this.container.style.textAlign = "center";

    this.elements = elements;
    this.currentSlideIndex = 0;
    this.buttons = buttons;

    // 🎨 Tint options
    this.tintColor = options.tintColor || "green";
    this.inactiveColor = options.inactiveColor || "gray";
    this.options = options;

    // 🔵 Default buttons adopt tintColor
    if (!this.buttons) {
      let buttons = {
        leftButton: new Button("L").set({
          frame: { width: 50, height: 50 },
          svg: this.createArrowSVG("left", 28, this.tintColor),
          color: this.tintColor,
          radius: "100%",
          arrayMargin: { sides: ["all"], value: "1rem" },
        }),

        rightButton: new Button("R").set({
          frame: { width: 50, height: 50 },
          svg: this.createArrowSVG("right", 28, this.tintColor),
          color: this.tintColor,
          radius: "100%",
          arrayMargin: { sides: ["all"], value: "1rem" },
        }),
      };
      this.buttons = buttons;
    }

    this.createSlider();
    this.init();
  }

  createArrowSVG(direction = "left", size = 28, color = "currentColor") {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.style.display = "block";
    svg.style.pointerEvents = "none";

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("fill", color);

    if (direction === "left") {
      path.setAttribute("d", "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z");
    } else {
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
    this.slider.style.height = this.options.height ?? "400px";
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
      slide.style.transformOrigin = "center center";
      slide.style.transform = "scale(1)";
      slide.style.scrollSnapAlign = "center";

      const rendered = text.render();
      slide.appendChild(rendered);

      // === Click to open overlay lightbox
      rendered.style.cursor = "pointer";
      rendered.addEventListener("click", () => {
        this.showLightbox(index);
      });

      slidesWrapper.appendChild(slide);
    });

    // Navigation arrows
    this.arrowPrev = this.buttons.leftButton.render();
    this.arrowPrev.style.position = "absolute";
    this.arrowPrev.style.left = "10px";
    this.arrowPrev.style.top = "50%";
    this.arrowPrev.style.transform = "translateY(-50%)";
    this.arrowPrev.style.zIndex = "1";
    this.arrowPrev.style.display = "flex";
    this.arrowPrev.style.alignItems = "center";
    this.arrowPrev.style.justifyContent = "center";
    this.arrowPrev.style.backgroundColor = "white";
    this.arrowPrev.style.padding = ".4rem";

    this.arrowNext = this.buttons.rightButton.render();
    this.arrowNext.style.position = "absolute";
    this.arrowNext.style.right = "10px";
    this.arrowNext.style.top = "50%";
    this.arrowNext.style.transform = "translateY(-50%)";
    this.arrowNext.style.zIndex = "1";
    this.arrowNext.style.display = "flex";
    this.arrowNext.style.alignItems = "center";
    this.arrowNext.style.justifyContent = "center";
    this.arrowNext.style.backgroundColor = "white";
    this.arrowNext.style.padding = ".4rem";

    // Navigation dots
    const nav = document.createElement("div");
    nav.style.position = "absolute";
    nav.style.bottom = "10%";
    nav.style.left = "50%";
    nav.style.transform = "translateX(-50%)";
    nav.style.textAlign = "center";
    nav.style.background = "#ffffff";
    nav.style.borderRadius = "1rem";
    nav.style.padding = ".2rem";
    nav.style.boxShadow = "3px 3px 10px #000";

    if (this.options.hideSelector){
      nav.style.display = "none";
    }

    this.elements.forEach((_, index) => {
      const navLink = document.createElement("a");
      navLink.style.display = "inline-block";
      navLink.style.height = "15px";
      navLink.style.width = "15px";
      navLink.style.borderRadius = "50%";
      navLink.style.backgroundColor = this.inactiveColor;
      navLink.style.margin = "0 10px";
      navLink.style.cursor = "pointer";
      navLink.dataset.index = index;
      nav.appendChild(navLink);
    });

    // ✅ Thumbnails section
    const thumbsContainer = document.createElement("div");
    thumbsContainer.style.display = "flex";
    thumbsContainer.style.justifyContent = "flex-start";
    thumbsContainer.style.margin = "1rem";
    thumbsContainer.style.gap = "10px";
    thumbsContainer.style.flexWrap = "nowrap";
    thumbsContainer.style.overflowX = "auto";

    if (this.options.hideThumbnails){
      thumbsContainer.style.display = "none";
    }

    const slides = slidesWrapper.querySelectorAll(".slide");
    slides.forEach((slide, index) => {
      const thumb = document.createElement("div");
      thumb.className = "slider-thumb";
      thumb.dataset.index = index.toString();
      thumb.style.width = "60px";
      thumb.style.height = "40px";
      thumb.style.border = `2px solid ${this.inactiveColor}`;
      thumb.style.borderRadius = "5px";
      thumb.style.overflow = "hidden";
      thumb.style.cursor = "pointer";
      thumb.style.flexShrink = "0";
      thumb.style.position = "relative";

      const sourceContent = slide.firstElementChild || slide.cloneNode(true);
      const preview = sourceContent.cloneNode(true);
      preview.style.transform = "scale(0.2)";
      preview.style.transformOrigin = "top left";
      preview.style.width = "300px";
      preview.style.height = "300px";
      preview.style.backgroundSize = "contain";
      preview.style.pointerEvents = "none";

      thumb.appendChild(preview);
      thumbsContainer.appendChild(thumb);
    });

    // Append elements
    this.slider.appendChild(this.arrowPrev);
    this.slider.appendChild(this.arrowNext);
    this.slider.appendChild(slidesWrapper);
    this.slider.appendChild(nav);

    this.container.appendChild(this.slider);
    this.container.appendChild(thumbsContainer);

    // Store references
    this.slidesWrapper = slidesWrapper;
    this.navLinks = Array.from(nav.querySelectorAll("a"));
    this.thumbs = Array.from(
      thumbsContainer.querySelectorAll(".slider-thumb")
    );
  }

  init() {
    this.updateActiveSlide();
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.arrowPrev.addEventListener("click", () => {
      this.moveToSlide(
        this.currentSlideIndex - 1 < 0
          ? this.elements.length - 1
          : this.currentSlideIndex - 1
      );
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

    this.thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const idx = parseInt(thumb.dataset.index, 10);
        this.moveToSlide(idx);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        this.moveToSlide(
          this.currentSlideIndex - 1 < 0
            ? this.elements.length - 1
            : this.currentSlideIndex - 1
        );
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
    // nav dots
    this.navLinks.forEach((navLink) => {
      const idx = parseInt(navLink.dataset.index, 10);
      navLink.style.backgroundColor =
        idx === this.currentSlideIndex
          ? this.tintColor
          : this.inactiveColor;
    });

    // thumbs
    this.thumbs.forEach((thumb) => {
      const idx = parseInt(thumb.dataset.index, 10);
      thumb.style.borderColor =
        idx === this.currentSlideIndex
          ? this.tintColor
          : this.inactiveColor;
    });

    // scroll slides
    const slideElem = this.slidesWrapper.querySelector(".slide");
    const slideWidth = slideElem
      ? slideElem.offsetWidth
      : this.slidesWrapper.clientWidth;
    this.slidesWrapper.scrollTo({
      left: this.currentSlideIndex * slideWidth,
      behavior: "smooth",
    });
  }
showLightbox(startIndex) {
  let currentIndex = startIndex;

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.style.cursor = "default";

  const lightboxContainer = document.createElement("div");
  lightboxContainer.style.position = "relative";
  lightboxContainer.style.display = "flex";
  lightboxContainer.style.alignItems = "center";
  lightboxContainer.style.justifyContent = "center";
  lightboxContainer.style.maxWidth = "90%";
  lightboxContainer.style.maxHeight = "90%";
  overlay.appendChild(lightboxContainer);
const renderSlide = (index) => {
  lightboxContainer.innerHTML = "";

  const original = this.elements[index].render();

  let img;
  if (original.tagName === "IMG") {
    img = original;
  } else {
    img = original.querySelector("img");
  }

  if (img) {
    const largeImg = document.createElement("img");
    largeImg.src = img.src;
    largeImg.style.maxWidth = "90vw";
    largeImg.style.maxHeight = "90vh";
    largeImg.style.objectFit = "contain";
    largeImg.style.pointerEvents = "none";
    largeImg.style.display = "block";
    lightboxContainer.appendChild(largeImg);
  } else {
    const content = original.cloneNode(true);
    content.style.width = "90vw";
    content.style.height = "90vh";
    content.style.maxWidth = "90vw";
    content.style.maxHeight = "90vh";
    content.style.pointerEvents = "none";
    lightboxContainer.appendChild(content);
  }
};


  renderSlide(currentIndex);

  // === Use existing slider buttons ===
  const prevBtn = this.buttons.leftButton.render().cloneNode(true);
  const nextBtn = this.buttons.rightButton.render().cloneNode(true);

  // Common styles for both nav buttons
  const baseBtnStyle = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    background: "white",
    border: "none",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "50px",
    height: "50px",
    margin: "1rem",
    padding: "0",
    zIndex: "10000",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  };

  Object.assign(prevBtn.style, baseBtnStyle, { left: "10px" });
  Object.assign(nextBtn.style, baseBtnStyle, { right: "10px" });

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentIndex =
      currentIndex - 1 < 0 ? this.elements.length - 1 : currentIndex - 1;
    renderSlide(currentIndex);
  });

  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % this.elements.length;
    renderSlide(currentIndex);
  });

  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);

  // === Close button ===
  const closeBtn = document.createElement("div");
  closeBtn.innerHTML = "✕";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "15px";
  closeBtn.style.right = "20px";
  closeBtn.style.fontSize = "2rem";
  closeBtn.style.color = "white";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.zIndex = "10000";
  closeBtn.style.userSelect = "none";
  closeBtn.style.transition = "transform 0.2s ease";
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.transform = "scale(1.2)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.transform = "scale(1)";
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.body.removeChild(overlay);
    document.removeEventListener("keydown", keyHandler);
  });
  overlay.appendChild(closeBtn);

  overlay.addEventListener("click", () => {
    document.body.removeChild(overlay);
    document.removeEventListener("keydown", keyHandler);
  });

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      document.body.removeChild(overlay);
      document.removeEventListener("keydown", keyHandler);
    } else if (e.key === "ArrowLeft") {
      currentIndex =
        currentIndex - 1 < 0 ? this.elements.length - 1 : currentIndex - 1;
      renderSlide(currentIndex);
    } else if (e.key === "ArrowRight") {
      currentIndex = (currentIndex + 1) % this.elements.length;
      renderSlide(currentIndex);
    }
  };
  document.addEventListener("keydown", keyHandler);

  document.body.appendChild(overlay);
}




  render(div) {
    if (div) {
      document.querySelector(div).appendChild(this.container);
    } else {
      return this.container;
    }
  }
}

export { Slider };
