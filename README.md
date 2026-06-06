# stream-slots

Out-of-order HTML streaming via [Declarative Partial Updates](https://github.com/WICG/declarative-partial-updates).

Define named slots, fill them in any order, and the browser renders content as it arrives. No client-side JavaScript required.

```
npm install stream-slots
```

## What is this?

Servers stream HTML top-to-bottom, so a slow database query for the header blocks everything below it. You end up either waiting for all the data before sending anything, or sending a shell and hydrating with client JS later. DPU gives you a third option: stream the shell immediately, then push each section into the page as its data resolves, in any order, with zero client JavaScript.

`stream-slots` wraps that in a clean API:

```js
import { createPage } from 'stream-slots';

const page = createPage({
  title: 'Dashboard',
  slots: [
    'header',
    { name: 'metrics', fallback: 'Loading metrics...' },
    'chart',
    'footer'
  ]
});

const stream = page.stream();

// Fill slots out of order. Footer before header!
page.fill('footer', '<footer>© 2026</footer>');
page.fill('header', '<h1>Dashboard</h1>');

// Async data? No problem.
const data = await fetchMetrics();
page.fill('metrics', renderMetrics(data));
page.fill('chart', renderChart(data));

page.close();

return new Response(stream, {
  headers: { 'Content-Type': 'text/html' }
});
```

The browser sees the page shell right away (with "Loading metrics..." as a placeholder), then each slot fills in as its `<template for="...">` fragment arrives.

## How it works

```
Server                                      Browser
------                                      -------
1. Send HTML shell with placeholders   ->   Fallback content shown
   <?start name="header"><?end>

2. Data for "footer" ready first       ->   Footer fills in
   <template for="footer">...</template>

3. Data for "header" ready             ->   Header fills in
   <template for="header">...</template>

4. Remaining slots fill as ready       ->   Progressive rendering!
```

Under the hood, `stream-slots` uses processing instructions (`<?start name="x">`) and `<template for="x">` elements from the [DPU patching spec](https://github.com/WICG/declarative-partial-updates/blob/main/patching-explainer.md). Chrome 148+ handles this natively when the experimental flag is on. No polyfill needed.

## API

### `createPage(options)`

Creates a new streaming page with a full HTML shell.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | `''` | Page `<title>` |
| `head` | `string` | `''` | Extra HTML for `<head>` (stylesheets, meta tags) |
| `lang` | `string` | `'en'` | HTML `lang` attribute |
| `charset` | `string` | `'utf-8'` | Charset meta tag |
| `slots` | `(string \| { name, fallback })[]` | **required** | Slot declarations. Strings or objects with optional fallback content. |
| `body` | `string` | auto | Custom body HTML. Use `{{slots}}` as the placeholder. |

**Returns a `Page` object:**

| Method / Property | Description |
|-------|-------------|
| `stream()` | Returns a `ReadableStream<Uint8Array>`. The shell is enqueued right away. Call once. |
| `fill(name, html)` | Fill a slot with HTML. Enqueues a `<template for="name">` chunk. |
| `append(name, html, keepOpen?)` | Append HTML to a slot. Leaves a `<?marker>` for further appends when `keepOpen` is true (default). |
| `error(name, err)` | Fill a slot with a styled error message. |
| `abort(err)` | Abort the entire stream with an error. |
| `close()` | Close the stream cleanly. |
| `isClosed` | `boolean` - whether the stream has been closed or aborted. |
| `filledSlots` | `Set<string>` - which slots have been filled so far. |
| `declaredSlots` | `Set<string>` - all declared slot names. |

### `createStream()`

Creates a lightweight stream for DPU fills without generating an HTML shell. Use this when you write your own HTML and only need the fill/append mechanism.

```js
import { createStream } from 'stream-slots';

const { stream, fill, append, close } = createStream();

// Write your own shell however you want
res.write(myCustomShell);

// Pipe the DPU fills
Readable.fromWeb(stream).pipe(res);

fill('header', '<h1>Hello</h1>');
close();
```

Returns `{ stream, fill, append, close, abort, isClosed }`.

### Low-level utilities

If you need more control, the building blocks are exported too:

```js
import {
  renderSlotPlaceholder,
  renderSlotFill,
  renderSlotAppend,
  createSlot,
  generateShell
} from 'stream-slots';

renderSlotPlaceholder('header')
// => '<?start name="header"><?end>'

renderSlotPlaceholder('header', 'Loading...')
// => '<?start name="header">Loading...<?end>'

renderSlotFill('header', '<h1>Hello</h1>')
// => '<template for="header"><h1>Hello</h1></template>'

renderSlotAppend('results', '<li>Item 1</li>')
// => '<template for="results"><li>Item 1</li><?marker name="results"></template>'

const slot = createSlot('sidebar');
slot.placeholder('Loading nav...')
slot.fill('<nav>Links</nav>')
slot.append('<li>More</li>')
```

## Streaming lists with append

The spec's `<?marker>` processing instruction lets you stream content incrementally into the same slot. This is perfect for search results, feeds, or any list that builds up over time:

```js
const page = createPage({
  title: 'Search',
  slots: [{ name: 'results', fallback: 'Searching...' }]
});

const stream = page.stream();

// Stream results as they come in
page.append('results', '<li>Result 1</li>');     // keeps slot open
page.append('results', '<li>Result 2</li>');     // keeps slot open
page.append('results', '<li>Result 3</li>', false); // final append
page.close();
```

Each `append()` sends a `<template for="results">` with a `<?marker>` that tells the browser where to insert the next chunk.

## Usage with Node.js HTTP

```js
import http from 'node:http';
import { Readable } from 'node:stream';
import { createPage } from 'stream-slots';

http.createServer(async (req, res) => {
  const page = createPage({
    title: 'My App',
    slots: [
      'header',
      { name: 'content', fallback: 'Loading...' },
      'sidebar'
    ]
  });

  res.writeHead(200, { 'Content-Type': 'text/html' });
  Readable.fromWeb(page.stream()).pipe(res);

  page.fill('header', '<h1>Hello World</h1>');

  setTimeout(() => {
    page.fill('sidebar', '<nav>Navigation</nav>');
  }, 500);

  setTimeout(() => {
    page.fill('content', '<p>Main content loaded!</p>');
    page.close();
  }, 1000);
}).listen(3000);
```

## Custom body layout

You can wrap the slots in your own markup using `{{slots}}`:

```js
const page = createPage({
  title: 'Dashboard',
  slots: ['nav', 'main', 'aside'],
  body: `
    <div style="display:grid; grid-template-columns:250px 1fr 300px; min-height:100vh;">
      {{slots}}
    </div>
  `
});
```

## Error handling

```js
try {
  const data = await fetchData();
  page.fill('widget', renderWidget(data));
} catch (err) {
  page.error('widget', err); // Shows a styled error in the slot
}

// Or abort the whole stream:
page.abort(new Error('Critical failure'));
```

## Browser support

| Feature | Status |
|---------|--------|
| DPU (native) | Chrome 148+ with `enable-experimental-web-platform-features` flag |
| Fallback | Slots show fallback content if DPU is not supported (progressive enhancement) |

## Demo

```bash
git clone https://github.com/nicolo-ribaudo/stream-slots
cd stream-slots
node demo/server.js
# Open http://localhost:3000
```

The playground lets you add slots, set delays, and watch the chunks arrive in real time.

## License

MIT
