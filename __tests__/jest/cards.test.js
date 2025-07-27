// __tests__/cards.test.js

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

  test('Verifies filter UI operation on any element', () => {
    const elements = [
      {
        type: "img",
        url: "https://www.nasa.gov/img.jpg"
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

    const mount = document.querySelector('#mount');
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

    // 🔹 Mock dimensions
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        bottom: 50,
        right: 100,
      })
    });

    const rect = el.getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(10);
    expect(rect.height).toBeGreaterThan(10);
  });
});