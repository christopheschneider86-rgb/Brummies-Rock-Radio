## 2024-05-24 - XSS in Globe Popup
**Vulnerability:** XSS vulnerability in the globe popup list. User-provided station data (name, country, bitrate, votes) is inserted into `.innerHTML` without sanitization. Untrusted data from Radio Browser API could execute arbitrary JavaScript.
**Learning:** Even though stations are fetched from an API, the station details are community-provided and must be treated as untrusted input. Using `.innerHTML` with unsanitized data creates an XSS risk.
**Prevention:** Use a helper function `escapeHtml` to escape HTML special characters before interpolating untrusted values into an HTML string, or use safe DOM methods like `document.createElement()` and `.textContent` instead of `.innerHTML`.
