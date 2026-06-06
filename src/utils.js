/**
 * @module utils
 * Small helpers for stream-slots.
 */

/**
 * Escapes HTML special characters to prevent injection in error messages
 * and other internally-generated markup.
 *
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Shared TextEncoder instance for converting strings to Uint8Array
 * for use with ReadableStream controllers.
 */
export const encoder = new TextEncoder();

/**
 * Encodes a string to a Uint8Array suitable for stream enqueuing.
 *
 * @param {string} str - The string to encode
 * @returns {Uint8Array} The encoded bytes
 */
export function encode(str) {
  return encoder.encode(str);
}
