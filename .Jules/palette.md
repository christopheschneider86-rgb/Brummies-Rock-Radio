## 2023-10-27 - Focus Visible
**Learning:** For accessibility compliance, the project uses `:focus-visible` (instead of `:focus`) in CSS for interactive elements (`button`, `a`, `[role="button"]`) to support keyboard navigation without showing unwanted outlines for mouse users.
**Action:** Add `:focus-visible` to interactive elements.
## 2023-10-27 - Label Association and ARIA Labels
**Learning:** HTML forms in custom vanilla UI may leave `<label>` orphaned and icon buttons lacking `<button aria-label="">` and `title=""`.
**Action:** Add `for` to `<label>` to map to inputs by ID. Add `aria-label` and `title` to custom symbol buttons.
