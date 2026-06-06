import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderSlotPlaceholder, renderSlotFill, renderSlotAppend, createSlot } from '../src/slot.js';

describe('renderSlotPlaceholder', () => {
  it('should generate spec-compliant processing instruction markup', () => {
    const result = renderSlotPlaceholder('header');
    assert.equal(result, '<?start name="header"><?end>');
  });

  it('should handle different slot names', () => {
    const result = renderSlotPlaceholder('my-sidebar');
    assert.equal(result, '<?start name="my-sidebar"><?end>');
  });

  it('should handle single-word names', () => {
    const result = renderSlotPlaceholder('main');
    assert.equal(result, '<?start name="main"><?end>');
  });

  it('should include fallback content between PIs', () => {
    const result = renderSlotPlaceholder('gallery', 'Loading...');
    assert.equal(result, '<?start name="gallery">Loading...<?end>');
  });

  it('should default to empty fallback', () => {
    const result = renderSlotPlaceholder('x');
    assert.ok(!result.includes('Loading'));
    assert.equal(result, '<?start name="x"><?end>');
  });
});

describe('renderSlotFill', () => {
  it('should wrap content in a template tag with for attribute', () => {
    const result = renderSlotFill('header', '<h1>Hello</h1>');
    assert.equal(result, '<template for="header"><h1>Hello</h1></template>');
  });

  it('should handle empty HTML content', () => {
    const result = renderSlotFill('header', '');
    assert.equal(result, '<template for="header"></template>');
  });

  it('should handle HTML with special characters', () => {
    const result = renderSlotFill('main', '<p class="test">A &amp; B</p>');
    assert.equal(
      result,
      '<template for="main"><p class="test">A &amp; B</p></template>'
    );
  });

  it('should handle multi-line HTML', () => {
    const html = `<div>
  <h1>Title</h1>
  <p>Content</p>
</div>`;
    const result = renderSlotFill('content', html);
    assert.equal(result, `<template for="content">${html}</template>`);
  });
});

describe('renderSlotAppend', () => {
  it('should include a marker PI when keepOpen is true', () => {
    const result = renderSlotAppend('results', '<li>Item 1</li>');
    assert.equal(
      result,
      '<template for="results"><li>Item 1</li><?marker name="results"></template>'
    );
  });

  it('should omit marker PI when keepOpen is false', () => {
    const result = renderSlotAppend('results', '<li>Last</li>', false);
    assert.equal(
      result,
      '<template for="results"><li>Last</li></template>'
    );
  });

  it('should default keepOpen to true', () => {
    const result = renderSlotAppend('feed', '<p>Post</p>');
    assert.ok(result.includes('<?marker name="feed">'));
  });
});

describe('createSlot', () => {
  it('should create a slot object with the given name', () => {
    const slot = createSlot('sidebar');
    assert.equal(slot.name, 'sidebar');
  });

  it('should generate placeholder via placeholder()', () => {
    const slot = createSlot('sidebar');
    assert.equal(
      slot.placeholder(),
      '<?start name="sidebar"><?end>'
    );
  });

  it('should generate placeholder with fallback', () => {
    const slot = createSlot('sidebar');
    assert.equal(
      slot.placeholder('Loading nav...'),
      '<?start name="sidebar">Loading nav...<?end>'
    );
  });

  it('should generate fill fragment via fill()', () => {
    const slot = createSlot('sidebar');
    assert.equal(
      slot.fill('<nav>Links</nav>'),
      '<template for="sidebar"><nav>Links</nav></template>'
    );
  });

  it('should generate append fragment via append()', () => {
    const slot = createSlot('list');
    assert.equal(
      slot.append('<li>Item</li>'),
      '<template for="list"><li>Item</li><?marker name="list"></template>'
    );
  });

  it('should generate final append without marker', () => {
    const slot = createSlot('list');
    assert.equal(
      slot.append('<li>Last</li>', false),
      '<template for="list"><li>Last</li></template>'
    );
  });
});
