import { Des } from '../lib/designer.js';

beforeAll(() => {
  // Mock matchMedia to simulate 700px viewport (within 600–800px range)
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: query.includes('min-width: 600px') && query.includes('max-width: 800px'),
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated but still present in many libs
    removeListener: jest.fn(),
    addEventListener: jest.fn(), // newer
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }));

   // Mock visualViewport
  window.visualViewport = {
    width: 700,
    height: 800,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
});

describe('Des UI Builder', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="mount"></div>';
  });

  test('renders an <h1> element and applies text-stroke at 600px–800px breakpoint', () => {
    const elements = [
      {
        type: 'h1',
        text: 'Hello',
      }
    ];

    const nodes = [
      {
        op: "blast",//,
        range: [600, 800]
      }
    ];

    new Des()
      .nodes(nodes)
      .add(elements)
      .set({
        mount: '#mount',
        code: false
      });

   const anchor = document.querySelector('#mount h1');
   console.log("APOE")
   console.log(anchor.style.cssText);

    expect(anchor).not.toBeNull();
    expect(anchor.textContent).toBe('Hello');

    const style = getComputedStyle(anchor);
  //  expect(style.webkitTextFillColor).toBe('transparent');
    expect(style.webkitTextStroke).toBe('1px green');
  });
});
