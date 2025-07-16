// __tests__/des.test.js

/**
 * Test for the Des UI builder
 * Assumes that the Des class and necessary elements are exported from lib/des.js
 */

import { Des } from '../lib/designer.js'; // Adjust this path if Des is in another file

describe('Des UI Builder', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="mount"></div>';
  });

  test('renders an a element with text', () => {
    const elements = [
      { 
        type: 'a', 
        text: 'Hello',
        link: "www.nasa.gov" 
      }
    ];

    new Des()
      .nodes([])
      .add(elements)
      .set({
        mount: '#mount',
        code: false
      });

    const h1 = document.querySelector('#mount a');
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe('Hello');
  });

});
