import {Animator} from "./animator.js";

class MultiSwitcherBeta {
    constructor() {
        this.views = [];
        this.container = null;
    }

    switchViews(views) {
        this.views = views;
        return this;
    }

    render(selector) {
        this.container = selector ? document.querySelector(selector) : document.createElement("div");

        if (!this.container) {
            console.error(`Container ${selector} not found`);
            return;
        }

        // Sort views by window width
        this.views.sort((a, b) => parseInt(a.at) - parseInt(b.at));

        // Add resize event listener
        window.addEventListener('resize', this.updateView.bind(this));

        // Initial render
        this.updateView();

        return this.container;
    }
/*
    updateView() {
        const windowWidth = window.innerWidth;

        for (let i = this.views.length - 1; i >= 0; i--) {
            if (windowWidth >= parseInt(this.views[i].at)) {
               // this.container.innerHTML = ''; // Clear current view
                this.container.appendChild(this.views[i].view); // Set new view
                break;
            }
        }
    }*/

        updateView() { // GPT 4o
            const windowWidth = window.innerWidth;

            for (let i = this.views.length - 1; i >= 0; i--) {
                if (windowWidth >= parseInt(this.views[i].at)) {
                    if (this.container.firstChild !== this.views[i].view) {
                        if (this.container.firstChild) {
                            this.container.replaceChild(this.views[i].view, this.container.firstChild);
                        } else {
                            this.container.appendChild(this.views[i].view);
                        }
                    }
                    break;
                }
            }
        }
} 
export { MultiSwitcherBeta };
