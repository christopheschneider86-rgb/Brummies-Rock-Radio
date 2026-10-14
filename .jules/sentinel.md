## 2024-05-24 - XSS in Globe Popup
**Vulnerability:** XSS vulnerability in the globe popup list. User-provided station data (name, country, bitrate, votes) is inserted into `.innerHTML` without sanitization. Untrusted data from Radio Browser API could execute arbitrary JavaScript.
**Learning:** Even though stations are fetched from an API, the station details are community-provided and must be treated as untrusted input. Using `.innerHTML` with unsanitized data creates an XSS risk.
**Prevention:** Use a helper function `escapeHtml` to escape HTML special characters before interpolating untrusted values into an HTML string, or use safe DOM methods like `document.createElement()` and `.textContent` instead of `.innerHTML`.
## 2024-05-18 - Type Confusion XSS in Sanitization Logic
**Vulnerability:** The global `escapeHtml` function checked `if (typeof unsafe !== 'string') return unsafe;` allowing malicious objects with custom `toString` methods (e.g. `{toString: () => "<script>..."}`) to bypass HTML escaping and cause DOM XSS when interpolated in templates.
**Learning:** Type checking and returning early for non-strings in sanitization functions is unsafe in JavaScript because non-string values can later be implicitly coerced to strings during DOM insertion (e.g. into `innerHTML`), bypassing the filter completely.
**Prevention:** Always coerce untrusted input to a string (using `String(input)`) before applying security-critical string replacements or filters.
