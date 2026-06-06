import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, createStream } from '../src/page.js';

/**
 * Helper: reads the entire ReadableStream and returns the concatenated string.
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {Promise<string>}
 */
async function readStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // flush
  return result;
}

/**
 * Helper: reads one chunk from the stream.
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @returns {Promise<string>}
 */
async function readChunk(reader) {
  const decoder = new TextDecoder();
  const { done, value } = await reader.read();
  if (done) return '';
  return decoder.decode(value);
}

describe('createPage', () => {
  it('should create a page with declared slots', () => {
    const page = createPage({ slots: ['header', 'main'] });
    assert.deepEqual(page.declaredSlots, new Set(['header', 'main']));
    assert.deepEqual(page.filledSlots, new Set());
    assert.equal(page.isClosed, false);
  });

  it('should support object slots with fallback', () => {
    const page = createPage({
      slots: ['header', { name: 'main', fallback: 'Loading...' }],
    });
    assert.deepEqual(page.declaredSlots, new Set(['header', 'main']));
  });

  it('should produce a ReadableStream', () => {
    const page = createPage({ slots: ['main'] });
    const stream = page.stream();
    assert.ok(stream instanceof ReadableStream);
  });

  it('should throw if stream() is called twice', () => {
    const page = createPage({ slots: ['main'] });
    page.stream();
    assert.throws(() => page.stream(), /only be called once/);
  });

  it('should emit the HTML shell as the first chunk', async () => {
    const page = createPage({
      title: 'Test',
      slots: ['main'],
    });
    const stream = page.stream();
    const reader = stream.getReader();
    const firstChunk = await readChunk(reader);

    assert.ok(firstChunk.includes('<!DOCTYPE html>'));
    assert.ok(firstChunk.includes('<title>Test</title>'));
    assert.ok(firstChunk.includes('<?start name="main">'));
    reader.releaseLock();
    page.close();
  });

  it('should include fallback content in shell', async () => {
    const page = createPage({
      slots: [{ name: 'hero', fallback: 'Loading hero...' }],
    });
    const stream = page.stream();
    const reader = stream.getReader();
    const shell = await readChunk(reader);

    assert.ok(shell.includes('<?start name="hero">Loading hero...<?end>'));
    reader.releaseLock();
    page.close();
  });

  it('should enqueue template fragments when fill() is called', async () => {
    const page = createPage({ slots: ['header', 'main'] });
    const stream = page.stream();
    const reader = stream.getReader();

    // Read shell
    await readChunk(reader);

    // Fill a slot
    page.fill('header', '<h1>Hello</h1>');
    const fillChunk = await readChunk(reader);
    assert.equal(fillChunk, '<template for="header"><h1>Hello</h1></template>');

    reader.releaseLock();
    page.close();
  });

  it('should track filled slots', () => {
    const page = createPage({ slots: ['header', 'main'] });
    page.stream();
    page.fill('header', '<h1>Hi</h1>');

    assert.ok(page.filledSlots.has('header'));
    assert.ok(!page.filledSlots.has('main'));
    page.close();
  });

  it('should allow re-filling a slot (replace mode)', async () => {
    const page = createPage({ slots: ['main'] });
    const stream = page.stream();
    const reader = stream.getReader();

    // Read shell
    await readChunk(reader);

    page.fill('main', '<p>First</p>');
    const first = await readChunk(reader);
    assert.ok(first.includes('First'));

    page.fill('main', '<p>Second</p>');
    const second = await readChunk(reader);
    assert.ok(second.includes('Second'));

    reader.releaseLock();
    page.close();
  });

  it('should throw when filling an undeclared slot', () => {
    const page = createPage({ slots: ['main'] });
    page.stream();
    assert.throws(() => page.fill('sidebar', 'hi'), /Unknown slot "sidebar"/);
    page.close();
  });

  it('should throw when filling before stream() is called', () => {
    const page = createPage({ slots: ['main'] });
    assert.throws(() => page.fill('main', 'hi'), /call stream\(\) first/);
  });

  it('should throw when filling after close()', () => {
    const page = createPage({ slots: ['main'] });
    page.stream();
    page.close();
    assert.throws(() => page.fill('main', 'hi'), /stream is closed/);
  });

  it('should close the stream', async () => {
    const page = createPage({ slots: ['main'] });
    const stream = page.stream();
    page.fill('main', '<p>Done</p>');
    page.close();

    assert.equal(page.isClosed, true);

    const output = await readStream(stream);
    assert.ok(output.includes('<!DOCTYPE html>'));
    assert.ok(output.includes('<template for="main">'));
  });

  it('should fill slot with error markup via error()', async () => {
    const page = createPage({ slots: ['widget'] });
    const stream = page.stream();
    const reader = stream.getReader();

    await readChunk(reader); // shell

    page.error('widget', new Error('Connection timeout'));
    const errorChunk = await readChunk(reader);

    assert.ok(errorChunk.includes('<template for="widget">'));
    assert.ok(errorChunk.includes('data-slot-error'));
    assert.ok(errorChunk.includes('Connection timeout'));
    assert.ok(errorChunk.includes('Error loading'));

    reader.releaseLock();
    page.close();
  });

  it('should abort the stream', async () => {
    const page = createPage({ slots: ['main'] });
    const stream = page.stream();
    const reader = stream.getReader();

    await readChunk(reader); // shell

    page.abort(new Error('Server crashed'));
    assert.equal(page.isClosed, true);

    // Reading after abort should reject
    await assert.rejects(() => reader.read(), /Server crashed/);
  });

  it('should handle fill with out-of-order slots', async () => {
    const page = createPage({ slots: ['first', 'second', 'third'] });
    const stream = page.stream();

    // Fill in reverse order
    page.fill('third', '<p>3</p>');
    page.fill('first', '<p>1</p>');
    page.fill('second', '<p>2</p>');
    page.close();

    const output = await readStream(stream);

    // All three fills should be present
    assert.ok(output.includes('<template for="third"><p>3</p></template>'));
    assert.ok(output.includes('<template for="first"><p>1</p></template>'));
    assert.ok(output.includes('<template for="second"><p>2</p></template>'));

    // And they should appear in the order they were filled (third, first, second)
    const thirdIdx = output.indexOf('for="third"');
    const firstIdx = output.indexOf('for="first"');
    const secondIdx = output.indexOf('for="second"');
    assert.ok(thirdIdx < firstIdx);
    assert.ok(firstIdx < secondIdx);
  });

  it('should include custom head content', async () => {
    const page = createPage({
      slots: ['main'],
      head: '<link rel="stylesheet" href="/styles.css">',
    });
    const stream = page.stream();
    page.fill('main', '<p>Hello</p>');
    page.close();

    const output = await readStream(stream);
    assert.ok(output.includes('<link rel="stylesheet" href="/styles.css">'));
  });

  it('should support custom body wrapper', async () => {
    const page = createPage({
      slots: ['main'],
      body: '<div class="custom-layout">{{slots}}</div>',
    });
    const stream = page.stream();
    page.fill('main', '<p>Content</p>');
    page.close();

    const output = await readStream(stream);
    assert.ok(output.includes('<div class="custom-layout">'));
    assert.ok(!output.includes('<main>'));
  });

  it('should append to a slot with marker PI', async () => {
    const page = createPage({ slots: ['results'] });
    const stream = page.stream();
    const reader = stream.getReader();

    await readChunk(reader); // shell

    page.append('results', '<li>Item 1</li>');
    const chunk1 = await readChunk(reader);
    assert.ok(chunk1.includes('<template for="results">'));
    assert.ok(chunk1.includes('<li>Item 1</li>'));
    assert.ok(chunk1.includes('<?marker name="results">'));

    page.append('results', '<li>Item 2</li>', false);
    const chunk2 = await readChunk(reader);
    assert.ok(chunk2.includes('<li>Item 2</li>'));
    assert.ok(!chunk2.includes('<?marker'));

    reader.releaseLock();
    page.close();
  });

  it('should throw when appending to undeclared slot', () => {
    const page = createPage({ slots: ['main'] });
    page.stream();
    assert.throws(() => page.append('nope', 'hi'), /Unknown slot "nope"/);
    page.close();
  });

  it('should throw when appending after close', () => {
    const page = createPage({ slots: ['main'] });
    page.stream();
    page.close();
    assert.throws(() => page.append('main', 'hi'), /stream is closed/);
  });
});

describe('createStream', () => {
  it('should return a stream object', () => {
    const s = createStream();
    assert.ok(s.stream instanceof ReadableStream);
    assert.equal(typeof s.fill, 'function');
    assert.equal(typeof s.append, 'function');
    assert.equal(typeof s.close, 'function');
    assert.equal(typeof s.abort, 'function');
    assert.equal(s.isClosed, false);
  });

  it('should not emit a shell', async () => {
    const s = createStream();
    s.fill('x', '<p>Hi</p>');
    s.close();

    const output = await readStream(s.stream);
    assert.ok(!output.includes('<!DOCTYPE'));
    assert.ok(output.includes('<template for="x"><p>Hi</p></template>'));
  });

  it('should support fill and append', async () => {
    const s = createStream();
    s.append('list', '<li>1</li>');
    s.append('list', '<li>2</li>', false);
    s.fill('title', '<h1>Done</h1>');
    s.close();

    const output = await readStream(s.stream);
    assert.ok(output.includes('<?marker name="list">'));
    assert.ok(output.includes('<template for="title">'));
  });

  it('should throw on fill after close', () => {
    const s = createStream();
    s.close();
    assert.throws(() => s.fill('x', 'hi'), /stream is closed/);
  });

  it('should abort the stream', async () => {
    const s = createStream();
    const reader = s.stream.getReader();
    s.abort(new Error('boom'));
    assert.equal(s.isClosed, true);
    await assert.rejects(() => reader.read(), /boom/);
  });
});
