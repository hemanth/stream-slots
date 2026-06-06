import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateShell } from '../src/shell.js';

describe('generateShell', () => {
  it('should generate a valid HTML document', () => {
    const html = generateShell({ slots: ['main'] });
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<html lang="en">'));
    assert.ok(html.includes('<head>'));
    assert.ok(html.includes('</head>'));
    assert.ok(html.includes('<body>'));
    assert.ok(html.includes('</body>'));
    assert.ok(html.includes('</html>'));
  });

  it('should include the title', () => {
    const html = generateShell({ title: 'My App', slots: [] });
    assert.ok(html.includes('<title>My App</title>'));
  });

  it('should include custom head content', () => {
    const html = generateShell({
      slots: [],
      head: '<link rel="stylesheet" href="/app.css">',
    });
    assert.ok(html.includes('<link rel="stylesheet" href="/app.css">'));
  });

  it('should set the lang attribute', () => {
    const html = generateShell({ lang: 'fr', slots: [] });
    assert.ok(html.includes('<html lang="fr">'));
  });

  it('should set the charset', () => {
    const html = generateShell({ charset: 'iso-8859-1', slots: [] });
    assert.ok(html.includes('<meta charset="iso-8859-1">'));
  });

  it('should render slot placeholders as spec-compliant PIs', () => {
    const html = generateShell({ slots: ['header', 'main', 'sidebar'] });
    assert.ok(html.includes('<?start name="header"><?end>'));
    assert.ok(html.includes('<?start name="main"><?end>'));
    assert.ok(html.includes('<?start name="sidebar"><?end>'));
  });

  it('should NOT wrap slots in data-slot divs', () => {
    const html = generateShell({ slots: ['header'] });
    assert.ok(!html.includes('data-slot'));
  });

  it('should render PIs directly without wrapper elements', () => {
    const html = generateShell({ slots: ['header'] });
    assert.ok(html.includes('<?start name="header"><?end>'));
    assert.ok(!html.includes('<div'));
  });

  it('should wrap slots in <main> by default', () => {
    const html = generateShell({ slots: ['content'] });
    assert.ok(html.includes('<main>'));
    assert.ok(html.includes('</main>'));
  });

  it('should use custom body with {{slots}} marker', () => {
    const html = generateShell({
      slots: ['content'],
      body: '<div class="app">{{slots}}</div>',
    });
    assert.ok(html.includes('<div class="app">'));
    assert.ok(html.includes('<?start name="content">'));
    assert.ok(!html.includes('<main>'));
  });

  it('should handle empty slots array', () => {
    const html = generateShell({ slots: [] });
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('<main>'));
  });

  it('should include viewport meta tag', () => {
    const html = generateShell({ slots: [] });
    assert.ok(html.includes('viewport'));
  });

  it('should support object slots with fallback content', () => {
    const html = generateShell({
      slots: [{ name: 'hero', fallback: 'Loading hero...' }],
    });
    assert.ok(html.includes('<?start name="hero">Loading hero...<?end>'));
  });

  it('should support mixed string and object slots', () => {
    const html = generateShell({
      slots: ['header', { name: 'main', fallback: 'Please wait...' }],
    });
    assert.ok(html.includes('<?start name="header"><?end>'));
    assert.ok(html.includes('<?start name="main">Please wait...<?end>'));
  });
});
