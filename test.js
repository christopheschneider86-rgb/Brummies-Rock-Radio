const fs = require('fs');
const jsdom = require("jsdom");
const assert = require('assert');
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');

const appJsContent = fs.readFileSync('app.js', 'utf8');

// Provide basic mocks for fetch and lucide
const mocks = `
  window.fetch = function() {
      return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
      });
  };
  window.lucide = {
      createIcons: function() {}
  };
  window.HTMLMediaElement.prototype.load = function() {};
`;

const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "http://localhost/" // Add a URL to prevent opaque origin error for localStorage
});

// Polyfill requestAnimationFrame which JSDOM lacks by default
dom.window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
dom.window.cancelAnimationFrame = (id) => clearTimeout(id);

// Inject mocks
const mockScriptEl = dom.window.document.createElement("script");
mockScriptEl.textContent = mocks;
dom.window.document.body.appendChild(mockScriptEl);

// Inject app.js
const scriptEl = dom.window.document.createElement("script");
scriptEl.textContent = appJsContent;
dom.window.document.body.appendChild(scriptEl);

dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));

const calculateDistance = dom.window.calculateDistance;

if (!calculateDistance) {
  console.error("Error: calculateDistance function is not accessible on window object.");
  process.exit(1);
}

try {
  // 1. Happy path: Berlin (52.5200, 13.4050) to Munich (48.1351, 11.5820)
  // Approximate distance is ~504 km
  const d1 = calculateDistance(52.5200, 13.4050, 48.1351, 11.5820);
  assert(d1 > 500 && d1 < 510, `Expected Berlin to Munich to be ~504km, got ${d1}`);

  // 2. Boundary case: Same point
  const d2 = calculateDistance(52.52, 13.405, 52.52, 13.405);
  assert.strictEqual(d2, 0, `Expected distance between the same point to be 0, got ${d2}`);

  // 3. Boundary case: Equator points
  // (0, 0) to (0, 90) - 90 degrees longitude on the equator.
  const R = 6371;
  const circumference = 2 * Math.PI * R;
  const d3 = calculateDistance(0, 0, 0, 90);
  const expectedD3 = circumference / 4;
  assert(Math.abs(d3 - expectedD3) < 1, `Expected distance to be ~${expectedD3}, got ${d3}`);

  // 4. Edge case: Antipodes (exact opposite points)
  // North Pole to South Pole
  const d4 = calculateDistance(90, 0, -90, 0);
  const expectedD4 = circumference / 2;
  assert(Math.abs(d4 - expectedD4) < 1, `Expected North Pole to South Pole to be ~${expectedD4}, got ${d4}`);

  // (0, 0) to (0, 180) - Equator opposite points
  const d5 = calculateDistance(0, 0, 0, 180);
  assert(Math.abs(d5 - expectedD4) < 1, `Expected equator antipodes to be ~${expectedD4}, got ${d5}`);

  // (0, 180) to (0, -180) - Same point represented differently
  const d6 = calculateDistance(0, 180, 0, -180);
  assert(Math.abs(d6 - 0) < 1, `Expected distance to be 0, got ${d6}`);

  // 5. Missing values
  const d7 = calculateDistance(52.52, 13.405, undefined, undefined);
  assert(Number.isNaN(d7), `Expected distance to be NaN when coordinates are undefined, got ${d7}`);

  console.log("✅ All tests passed successfully!");
  process.exit(0);

} catch (error) {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
}
