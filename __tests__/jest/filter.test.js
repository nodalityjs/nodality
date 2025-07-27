// __tests__/cards.test.js


/**
 * Test for Des UI builder rendering "cards" component
 * Assumes that the Des class interprets { type: "cards" } as a grid of cards with specified children
 */

import { Des } from '../lib/designer.js';

describe('Filter UI test', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="mount"></div>';

    Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      width: 1024,
      height: 768
    }
  });
  });

  test('Verifies filter UI operation', () => {
    const elements = [
     /* {
        type: "img",
        url: "https://www.nasa.gov/img.jpg"
      }*/

        {
          type: "h1",
          text: "A"
        }
    ];

    const nodes = [
      {
        op: "filter"
      }
    ];

    new Des()
      .nodes(nodes)
      .add(elements)
      .set({
        mount: '#mount',
        code: false
      });

      // RUN SINGLE TEST ONLY
     // npx jest -t 'Verifies filter UI operation' 15/07/25

  /* const rendered = document.querySelector('#mount');
   console.log(document.querySelector('#mount').innerHTML);

  const img = document.querySelector('#mount img');
  expect(img).not.toBeNull();

   // 🔹 Filter style applied
    expect(img.style.filter).not.toBe('');
    expect(img.style.filter).toMatch(/grayscale|blur|contrast|brightness|saturate|sepia/);

    // 🔹 Image is visible
    const style = window.getComputedStyle(img);
    expect(style.display).not.toBe('none');
    expect(style.visibility).not.toBe('hidden');
    expect(style.opacity).not.toBe('0');
*/

  expect(mount).not.toBeNull();

    // Grab first rendered element (generic)
    const el = mount.querySelector('*');
    expect(el).not.toBeNull();

    // 🔹 Style: filter should be applied
    expect(el.style.filter).not.toBe('');
    expect(el.style.filter).toMatch(/grayscale|blur|contrast|brightness|saturate|sepia/);

    // 🔹 Style: visibility
    const style = window.getComputedStyle(el);
    expect(style.display).not.toBe('none');
    expect(style.visibility).not.toBe('hidden');
    expect(style.opacity).not.toBe('0');
/* will return 0
    const rect = img.getBoundingClientRect();
    console.log("DIMS");
    console.log(rect.height);
    console.log(rect.width);*/


    // 🔹 Image has non-zero dimensions (>10px)
 //   const rect = img.getBoundingClientRect();
 //   expect(rect.width).toBeGreaterThan(10);
  //  expect(rect.height).toBeGreaterThan(10);
  //expect(img.style.filter).not.toBe('');

 
  });
});
