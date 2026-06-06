/**
 * stream-slots
 *
 * Out-of-order HTML streaming via Declarative Partial Updates.
 * Define named slots, fill them in any order, and the browser
 * renders content as it arrives. No client-side JS required.
 *
 * @module stream-slots
 *
 * @example
 * import { createPage } from 'stream-slots';
 *
 * const page = createPage({
 *   title: 'My Dashboard',
 *   slots: ['header', { name: 'main', fallback: 'Loading...' }]
 * });
 *
 * const stream = page.stream();
 *
 * page.fill('header', '<h1>Dashboard</h1>');
 * page.fill('main', '<p>Content loaded!</p>');
 * page.close();
 *
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/html' }
 * });
 */

export { createPage, createStream } from './page.js';
export { createSlot, renderSlotPlaceholder, renderSlotFill, renderSlotAppend } from './slot.js';
export { generateShell } from './shell.js';
export { escapeHtml } from './utils.js';
