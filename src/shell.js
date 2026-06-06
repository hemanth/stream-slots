/**
 * @module shell
 * Generates the initial HTML document shell with DPU placeholder
 * processing instructions for each declared slot.
 */

import { renderSlotPlaceholder } from './slot.js';

/**
 * Normalizes a slot entry from the slots array.
 * Slots can be plain strings or objects with { name, fallback }.
 *
 * @param {string | { name: string, fallback?: string }} slot
 * @returns {{ name: string, fallback: string }}
 */
function normalizeSlot(slot) {
  if (typeof slot === 'string') {
    return { name: slot, fallback: '' };
  }
  return { name: slot.name, fallback: slot.fallback || '' };
}

/**
 * @typedef {string | { name: string, fallback?: string }} SlotEntry
 */

/**
 * @typedef {Object} ShellOptions
 * @property {string} [title=''] - The page <title>
 * @property {string} [head=''] - Additional HTML to inject into <head> (stylesheets, meta tags, etc.)
 * @property {string} [lang='en'] - The html lang attribute
 * @property {string} [charset='utf-8'] - The charset meta tag value
 * @property {SlotEntry[]} slots - Array of slot names or { name, fallback } objects
 * @property {string} [body] - Custom body wrapper HTML. Use `{{slots}}` as the marker
 *   where slot placeholders should be injected. If omitted, slots are rendered
 *   sequentially inside a <main> element.
 */

/**
 * Generates a full HTML document shell with DPU processing instruction
 * placeholders for each declared slot.
 *
 * The shell is designed to be sent immediately as the first chunk of
 * a streamed HTTP response. Slot content arrives later via
 * `<template for="name">` fragments.
 *
 * @param {ShellOptions} options
 * @returns {string} The complete HTML shell document
 *
 * @example
 * generateShell({
 *   title: 'My Dashboard',
 *   head: '<link rel="stylesheet" href="/app.css">',
 *   slots: ['header', { name: 'main', fallback: 'Loading...' }]
 * })
 */
export function generateShell(options) {
  const {
    title = '',
    head = '',
    lang = 'en',
    charset = 'utf-8',
    slots = [],
    body,
  } = options;

  // Generate placeholder markup for each slot (no wrapper divs)
  const slotMarkup = slots
    .map((slot) => {
      const { name, fallback } = normalizeSlot(slot);
      return renderSlotPlaceholder(name, fallback);
    })
    .join('\n    ');

  // Build the body content
  let bodyContent;
  if (body) {
    // User provided custom body wrapper — inject slots at {{slots}} marker
    bodyContent = body.replace('{{slots}}', slotMarkup);
  } else {
    // Default: wrap slots in a <main> element
    bodyContent = `<main>\n    ${slotMarkup}\n  </main>`;
  }

  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="${charset}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    ${head}
  </head>
  <body>
  ${bodyContent}
  </body>
</html>`;
}

export { normalizeSlot };
