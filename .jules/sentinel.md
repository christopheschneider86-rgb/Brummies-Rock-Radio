## 2024-05-18 - Prevent XSS in Radio Browser API DOM Insertions
**Vulnerability:** User-contributed data from the Radio Browser API (`name`, `country`, `favicon`) was inserted directly into the DOM using `innerHTML` without prior sanitization, leading to a Cross-Site Scripting (XSS) vulnerability.
**Learning:** External APIs that aggregate community-contributed data must be treated as untrusted sources. Bypassing sanitization when setting `innerHTML` can execute malicious scripts injected into the data fields.
**Prevention:** Always sanitize untrusted input before using it in `innerHTML`. Define and apply a robust `escapeHTML` function to escape HTML special characters (`&`, `<`, `>`, `"`, `'`) for all untrusted data.
