## 2024-10-06 - XSS Vulnerability in Radio Browser API Data
**Vulnerability:** Cross-Site Scripting (XSS) via untrusted community data (station name, country, favicon) injected using `innerHTML`.
**Learning:** External API data, even if seemingly benign like radio station metadata, must be treated as untrusted and safely escaped before DOM insertion.
**Prevention:** Use DOM creation methods (`createElement`, `textContent`) or HTML escaping functions when rendering data from external APIs.
