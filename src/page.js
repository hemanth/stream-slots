/**
 * @module page
 * The main stream-slots API. Creates a page with named slots that
 * can be filled in any order, streaming HTML to the browser using
 * Declarative Partial Updates.
 */

import { generateShell, normalizeSlot } from './shell.js';
import { renderSlotFill, renderSlotAppend } from './slot.js';
import { encode, escapeHtml } from './utils.js';

/**
 * @typedef {string | { name: string, fallback?: string }} SlotEntry
 */

/**
 * @typedef {Object} PageOptions
 * @property {string} [title=''] - The page <title>
 * @property {string} [head=''] - Additional HTML for <head>
 * @property {string} [lang='en'] - The html lang attribute
 * @property {string} [charset='utf-8'] - The charset
 * @property {SlotEntry[]} slots - Array of slot names or { name, fallback } objects
 * @property {string} [body] - Custom body HTML with {{slots}} marker
 */

/**
 * @typedef {Object} Page
 * @property {() => ReadableStream<Uint8Array>} stream - Get the ReadableStream. Shell is enqueued on creation.
 * @property {(name: string, html: string) => void} fill - Fill a slot with HTML content
 * @property {(name: string, html: string, keepOpen?: boolean) => void} append - Append HTML to a slot (streaming lists)
 * @property {(name: string, err: Error) => void} error - Fill a slot with an error message
 * @property {(err?: Error) => void} abort - Abort the stream with an error
 * @property {() => void} close - Close the stream
 * @property {boolean} isClosed - Whether the stream has been closed or aborted
 * @property {Set<string>} filledSlots - Set of slot names that have been filled
 * @property {Set<string>} declaredSlots - Set of all declared slot names
 */

/**
 * Creates a new streaming page with named DPU slots.
 *
 * The returned page object produces a `ReadableStream` that first emits the
 * HTML shell (with processing instruction placeholders), then emits
 * `<template for="name">` fragments each time `fill()` or `append()` is called.
 *
 * Slots can be filled in any order. The browser's DPU implementation
 * matches each template to its placeholder and renders the content
 * in-place, regardless of arrival order.
 *
 * @param {PageOptions} options
 * @returns {Page}
 *
 * @example
 * const page = createPage({
 *   title: 'My App',
 *   slots: ['header', { name: 'main', fallback: 'Loading...' }]
 * });
 *
 * const stream = page.stream();
 * page.fill('header', '<h1>Hello</h1>');
 * page.fill('main', '<p>Content</p>');
 * page.close();
 */
export function createPage(options) {
  const {
    title = '',
    head = '',
    lang = 'en',
    charset = 'utf-8',
    slots = [],
    body,
  } = options;

  // Normalize slot entries to extract names
  const normalizedSlots = slots.map(normalizeSlot);

  /** @type {Set<string>} */
  const declaredSlots = new Set(normalizedSlots.map((s) => s.name));

  /** @type {Set<string>} */
  const filledSlots = new Set();

  /** @type {ReadableStreamDefaultController<Uint8Array> | null} */
  let controller = null;

  /** @type {boolean} */
  let closed = false;

  /** @type {boolean} */
  let streamCreated = false;

  // Generate the shell HTML
  const shellHtml = generateShell({ title, head, lang, charset, slots, body });

  /**
   * Enqueue a string chunk into the stream.
   * @param {string} html
   */
  function enqueue(html) {
    if (closed || !controller) return;
    try {
      controller.enqueue(encode(html));
    } catch {
      // Stream may have been cancelled by the consumer
      closed = true;
    }
  }

  /** @type {Page} */
  const page = {
    get isClosed() {
      return closed;
    },

    get filledSlots() {
      return new Set(filledSlots);
    },

    get declaredSlots() {
      return new Set(declaredSlots);
    },

    stream() {
      if (streamCreated) {
        throw new Error('stream() can only be called once per page');
      }
      streamCreated = true;

      return new ReadableStream({
        start(ctrl) {
          controller = ctrl;
          // Immediately enqueue the shell
          enqueue(shellHtml);
        },
        cancel() {
          closed = true;
          controller = null;
        },
      });
    },

    fill(name, html) {
      if (closed) {
        throw new Error(`Cannot fill slot "${name}": stream is closed`);
      }
      if (!streamCreated) {
        throw new Error(`Cannot fill slot "${name}": call stream() first`);
      }
      if (!declaredSlots.has(name)) {
        throw new Error(
          `Unknown slot "${name}". Declared slots: ${[...declaredSlots].join(', ')}`
        );
      }

      filledSlots.add(name);
      const fragment = renderSlotFill(name, html);
      enqueue(fragment);
    },

    append(name, html, keepOpen = true) {
      if (closed) {
        throw new Error(`Cannot append to slot "${name}": stream is closed`);
      }
      if (!streamCreated) {
        throw new Error(`Cannot append to slot "${name}": call stream() first`);
      }
      if (!declaredSlots.has(name)) {
        throw new Error(
          `Unknown slot "${name}". Declared slots: ${[...declaredSlots].join(', ')}`
        );
      }

      filledSlots.add(name);
      const fragment = renderSlotAppend(name, html, keepOpen);
      enqueue(fragment);
    },

    error(name, err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorHtml = `<div data-slot-error="${escapeHtml(name)}" style="color:#ef4444;padding:1rem;border:1px solid #ef4444;border-radius:0.5rem;margin:0.5rem 0;font-family:system-ui,sans-serif;"><strong>Error loading "${escapeHtml(name)}"</strong><p style="margin:0.25rem 0 0;opacity:0.8;">${escapeHtml(message)}</p></div>`;
      // Use fill() so it goes through the same validation
      page.fill(name, errorHtml);
    },

    abort(err) {
      if (closed || !controller) return;
      closed = true;
      try {
        controller.error(err instanceof Error ? err : new Error(String(err)));
      } catch {
        // Already errored or closed
      }
      controller = null;
    },

    close() {
      if (closed || !controller) return;
      closed = true;
      try {
        controller.close();
      } catch {
        // Already closed
      }
      controller = null;
    },
  };

  return page;
}

/**
 * Creates a lightweight stream for DPU fills without generating an HTML shell.
 * Use this when you write your own HTML (from a template engine, framework, etc.)
 * and only need the streaming fill/append mechanism.
 *
 * @returns {{ stream: ReadableStream<Uint8Array>, fill: (name: string, html: string) => void, append: (name: string, html: string, keepOpen?: boolean) => void, close: () => void, abort: (err?: Error) => void, isClosed: boolean }}
 *
 * @example
 * const { stream, fill, close } = createStream();
 *
 * // Write your own shell however you want
 * res.write(myShellHtml);
 *
 * // Pipe the DPU fills
 * Readable.fromWeb(stream).pipe(res);
 *
 * fill('header', '<h1>Hello</h1>');
 * close();
 */
export function createStream() {
  /** @type {ReadableStreamDefaultController<Uint8Array> | null} */
  let controller = null;
  let closed = false;

  function enqueue(html) {
    if (closed || !controller) return;
    try {
      controller.enqueue(encode(html));
    } catch {
      closed = true;
    }
  }

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      closed = true;
      controller = null;
    },
  });

  return {
    stream,

    get isClosed() {
      return closed;
    },

    fill(name, html) {
      if (closed) throw new Error(`Cannot fill slot "${name}": stream is closed`);
      enqueue(renderSlotFill(name, html));
    },

    append(name, html, keepOpen = true) {
      if (closed) throw new Error(`Cannot append to slot "${name}": stream is closed`);
      enqueue(renderSlotAppend(name, html, keepOpen));
    },

    close() {
      if (closed || !controller) return;
      closed = true;
      try { controller.close(); } catch { /* already closed */ }
      controller = null;
    },

    abort(err) {
      if (closed || !controller) return;
      closed = true;
      try { controller.error(err instanceof Error ? err : new Error(String(err))); } catch { /* already errored */ }
      controller = null;
    },
  };
}
