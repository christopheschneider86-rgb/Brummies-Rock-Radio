const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
dom.window.console.log = function() {}; // ignore normal logs
dom.window.console.warn = function() {};
dom.window.console.error = function(...args) { console.error("BROWSER ERROR:", ...args); };
dom.window.addEventListener('error', (event) => {
  console.error("GLOBAL ERROR:", event.error);
});
setTimeout(() => {
  console.log("Done waiting");

  // Test parseGenericJson
  console.log("Running parseGenericJson tests...");
  const appCode = fs.readFileSync('app.js', 'utf8');
  const match = appCode.match(/function parseGenericJson\(text\) \{[\s\S]*?return null;\n\s*\}/);
  if (!match) {
    console.error("Function parseGenericJson not found in app.js");
    process.exit(1);
  }

  let parseGenericJson;
  eval('parseGenericJson = ' + match[0]);

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`Test failed: ${message} - Expected: ${expected}, Actual: ${actual}`);
    }
  }

  try {
    assertEqual(parseGenericJson('{"title": "Test Title"}'), "Test Title", "Simple title");
    assertEqual(parseGenericJson('{"song": "Test Song"}'), "Test Song", "Simple song");
    assertEqual(parseGenericJson('{"track": "Test Track"}'), "Test Track", "Simple track");
    assertEqual(parseGenericJson('{"now_playing": {"song": {"title": "Now Playing Title"}}}'), "Now Playing Title", "Nested now_playing title");
    assertEqual(parseGenericJson('{"current_track": {"title": "Current Track Title"}}'), "Current Track Title", "Nested current_track title");
    assertEqual(parseGenericJson('{"live": {"is_live": false}, "song": {"title": "Not Live Song"}}'), "Not Live Song", "Live is_live=false fallback");
    assertEqual(parseGenericJson('{"live": {"is_live": true}, "song": {"title": "Live Song"}}'), null, "Live is_live=true fallback");
    assertEqual(parseGenericJson('invalid json'), null, "Invalid JSON");
    assertEqual(parseGenericJson('{"other_field": "value"}'), null, "No matching fields");

    console.log("All parseGenericJson tests passed!");
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  process.exit(0);
}, 2000);
