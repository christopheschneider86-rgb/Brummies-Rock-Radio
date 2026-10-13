## 2024-05-24 - XSS in Globe Popup
**Vulnerability:** XSS vulnerability in the globe popup list. User-provided station data (name, country, bitrate, votes) is inserted into `.innerHTML` without sanitization. Untrusted data from Radio Browser API could execute arbitrary JavaScript.
**Learning:** Even though stations are fetched from an API, the station details are community-provided and must be treated as untrusted input. Using `.innerHTML` with unsanitized data creates an XSS risk.
**Prevention:** Use a helper function `escapeHtml` to escape HTML special characters before interpolating untrusted values into an HTML string, or use safe DOM methods like `document.createElement()` and `.textContent` instead of `.innerHTML`.

## 2024-05-24 - XSS Filter Bypass via Type Confusion
**Vulnerability:** The `escapeHtml` function checked `if (typeof unsafe !== 'string') return unsafe;`. If an attacker provides an array like `['<script>alert(1)</script>']` (e.g., via JSON from an external API), the function returns the array unescaped. When inserted into a template literal, JavaScript implicitly calls `.toString()` on the array, rendering the malicious payload and executing XSS.
**Learning:** Custom sanitization functions must coerce inputs to a string before processing, rather than returning non-string types early. Type confusion can easily bypass regex-based filters.
**Prevention:** Use `String(unsafe)` to coerce the value before applying `.replace()`, and handle `null`/`undefined` explicitly.
