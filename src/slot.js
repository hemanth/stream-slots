/**
 * @module slot
 * Low-level slot utilities for generating DPU processing instruction
 * placeholders and <template for> fill fragments.
 *
 * These follow the WICG Declarative Partial Updates specification:
 * https://github.com/WICG/declarative-partial-updates
 */

/**
 * Renders a DPU placeholder using processing instructions.
 * The browser will hold this position in the DOM, and when a
 * matching `<template for="name">` arrives later in the stream,
 * its content replaces the placeholder region.
 *
 * Supports optional fallback content displayed while the slot is loading.
 *
 * @param {string} name - The slot name (must be unique within the page)
 * @param {string} [fallback=''] - Optional fallback content shown before the slot is filled
 * @returns {string} The processing instruction placeholder HTML
 *
 * @example
 * renderSlotPlaceholder('header')
 * // => '<?start name="header"><?end>'
 *
 * renderSlotPlaceholder('header', 'Loading...')
 * // => '<?start name="header">Loading...<?end>'
 */
export function renderSlotPlaceholder(name, fallback = '') {
  return `<?start name="${name}">${fallback}<?end>`;
}

/**
 * Renders a DPU fill fragment that targets a named placeholder.
 * When the browser encounters this in the stream, it replaces
 * the content between the matching <?start> and <?end> PIs.
 *
 * @param {string} name - The slot name to fill
 * @param {string} html - The HTML content to inject
 * @returns {string} The template fill fragment
 *
 * @example
 * renderSlotFill('header', '<h1>Dashboard</h1>')
 * // => '<template for="header"><h1>Dashboard</h1></template>'
 */
export function renderSlotFill(name, html) {
  return `<template for="${name}">${html}</template>`;
}

/**
 * Renders a DPU append fragment that targets a named marker.
 * Unlike fill, append inserts content at a marker position and
 * optionally leaves a new marker for subsequent appends.
 *
 * This maps to the spec's <?marker> processing instruction,
 * enabling streaming lists, search results, and other
 * incrementally-built content.
 *
 * @param {string} name - The slot name to append to
 * @param {string} html - The HTML content to insert
 * @param {boolean} [keepOpen=true] - If true, inserts a new <?marker> for further appends
 * @returns {string} The template append fragment
 *
 * @example
 * renderSlotAppend('results', '<li>Result 1</li>')
 * // => '<template for="results"><li>Result 1</li><?marker name="results"></template>'
 *
 * renderSlotAppend('results', '<li>Last</li>', false)
 * // => '<template for="results"><li>Last</li></template>'
 */
export function renderSlotAppend(name, html, keepOpen = true) {
  const marker = keepOpen ? `<?marker name="${name}">` : '';
  return `<template for="${name}">${html}${marker}</template>`;
}

/**
 * Creates a slot object with convenience methods.
 *
 * @param {string} name - The slot name
 * @returns {{ name: string, placeholder: (fallback?: string) => string, fill: (html: string) => string, append: (html: string, keepOpen?: boolean) => string }}
 */
export function createSlot(name) {
  return {
    name,
    /** Generate the placeholder PI markup */
    placeholder(fallback = '') {
      return renderSlotPlaceholder(name, fallback);
    },
    /** Generate a fill fragment for this slot */
    fill(html) {
      return renderSlotFill(name, html);
    },
    /** Generate an append fragment for this slot */
    append(html, keepOpen = true) {
      return renderSlotAppend(name, html, keepOpen);
    },
  };
}
