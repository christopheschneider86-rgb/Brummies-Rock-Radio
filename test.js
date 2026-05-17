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
  process.exit(0);
}, 2000);
