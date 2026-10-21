## 2023-10-27 - Focus Visible
**Learning:** For accessibility compliance, the project uses `:focus-visible` (instead of `:focus`) in CSS for interactive elements (`button`, `a`, `[role="button"]`) to support keyboard navigation without showing unwanted outlines for mouse users.
**Action:** Add `:focus-visible` to interactive elements.
## 2023-10-27 - Label Association and ARIA Labels
**Learning:** HTML forms in custom vanilla UI may leave `<label>` orphaned and icon buttons lacking `<button aria-label="">` and `title=""`.
**Action:** Add `for` to `<label>` to map to inputs by ID. Add `aria-label` and `title` to custom symbol buttons.
## 2023-11-20 - Standalone Layout Controls Accessibility
**Learning:** Some custom skins (like DJ, Retro, and Globe) utilize standalone `input` (text and range) and `select` elements where the layout does not permit a separate visible `<label>` element. These easily become inaccessible to screen reader users if no alternative description is provided.
**Action:** When working on complex layouts and standalone controls, make sure to add `aria-label` directly to the `input` or `select` elements to provide screen reader context.

## 2026-10-21 - [Added for attributes to Custom Theme Creator labels]
**Learning:** In the Custom Theme Creator grid, the `<label>` tags were structurally separated from their corresponding `<input type="color">` elements without any programmatic association. Adding explicitly matched `for` attributes improves accessibility for screen readers and allows users to click the text labels to focus the inputs.
**Action:** Always ensure that every `<label>` tag correctly references the `id` of its corresponding interactive input using a `for` attribute, particularly in custom grids or separated layouts where standard nesting is bypassed.
