import { Animator } from "./animator.js";

class ScrollVideo {
    constructor() {
        this.frameNumber = 0; // Start video at frame 0
        this.res = document.createElement("div");
        this.vid = null;
        this.minScrollHeight = 0; // Default minimum scroll height
        this.maxScrollHeight = 1000; // Default maximum scroll height
        this.videoUrl = ""; // Default video URL
    }

    set({ minScrollHeight = 0, maxScrollHeight = 1000, videoUrl = "" } = {}) {
        this.minScrollHeight = minScrollHeight;
        this.maxScrollHeight = maxScrollHeight;
        this.videoUrl = videoUrl;

        // Create elements after settings are provided
        this.createElements("V0");

        // Select video element after creation
        this.vid = this.res.children[0];

        // Initialize event listeners and behavior
        this.init();
        return this; // Allow chaining
    }

    createElements(videoElementId) {
        // Create and style the video element
        const video = document.createElement("video");
        video.id = videoElementId;
        video.setAttribute("tabindex", "0");
        video.setAttribute("autobuffer", "autobuffer");
        video.setAttribute("preload", "preload");
        video.style.position = "sticky";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100%";
        video.style.height = "100vh";
        video.style.border = "1px solid orange";

        // Create and append the source element to the video
        const source = document.createElement("source");
        source.type = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
        source.src = this.videoUrl;
        video.appendChild(source);

        // Append the video element to the container
        this.res.appendChild(video);

        // Create and style the paragraph element
        const paragraph = document.createElement("p");
        paragraph.id = "time";
        paragraph.style.fontFamily = "Helvetica, Arial, sans-serif";
        paragraph.style.fontSize = "24px";
        this.res.appendChild(paragraph);

        // Create and style the set-height div element
        const setHeight = document.createElement("div");
        setHeight.id = "set-height";
        setHeight.style.display = "block";
        this.res.appendChild(setHeight);
    }

    sticky() {
        this.res.style.position = "sticky";
        this.res.style.top = 0;
        return this;
    }

    init() {
        // Set up event listener for when the video metadata is loaded
        this.vid.addEventListener("loadedmetadata", () => {
            // Dynamically set the page height based on video duration
            const setHeight = document.getElementById("set-height");
            if (setHeight) {
                const scrollableHeight = this.maxScrollHeight - this.minScrollHeight;
                setHeight.style.height = `${scrollableHeight}px`;
            } else {
                console.error("Error: 'set-height' element not found.");
            }
        });

        // Start the scroll-play functionality
        this.scrollPlay();
    }
    scrollPlay() {
        // Ensure the video duration is loaded before trying to calculate currentTime
        if (!this.vid || isNaN(this.vid.duration)) {
            window.requestAnimationFrame(() => this.scrollPlay());
            return;
        }
    
        // Calculate the frame number based on scroll position
        const scrollPosition = Math.max(
            this.minScrollHeight,
            Math.min(window.pageYOffset, this.maxScrollHeight)
        );
    
        const scrollRange = this.maxScrollHeight - this.minScrollHeight;
        const normalizedScroll = (scrollPosition - this.minScrollHeight) / scrollRange;
    
        // Update the video currentTime property
        this.vid.currentTime = normalizedScroll * this.vid.duration;
    
        // Request the next animation frame for smooth playback
        window.requestAnimationFrame(() => this.scrollPlay());
    }
    
    toCode() {
        return [""];
    }
    render() {
        // Return the container div with all elements
        return this.res;
    }
}

export { ScrollVideo };
