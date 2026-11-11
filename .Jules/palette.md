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

## 2026-10-21 - Icon Tooltips and Shortcut Discovery
**Learning:** Abstract icon-only buttons (like those for sorting or playback) often have `aria-label`s for screen readers but omit `title` attributes, leaving visual users without context. Furthermore, existing keyboard shortcuts remain hidden unless users explicitly find the settings panel. Surfacing these shortcuts in tooltips significantly improves UX.
**Action:** When adding or auditing icon-only buttons, always ensure a `title` attribute is present alongside the `aria-label`. If a button has an associated keyboard shortcut, append it to the tooltip (e.g., `title="Abspielen / Pausieren (Leertaste)"`) to boost discoverability.
## 2026-11-10 - Add loading state to async search
**Learning:** Community APIs like Radio Browser can sometimes be slow to respond. When users trigger an async search action without visual feedback, they often think the UI is unresponsive and click multiple times, which can lead to layout thrashing or buggy UI states if the requests finish out of order. Adding an inline loading spinner directly inside the primary action button (`searchBtn`) provides immediate feedback, manages expectations, and prevents redundant API calls. Also, when using third-party JS libraries for DOM manipulation (like `lucide.createIcons`), scope the changes explicitly (e.g. `{ root: searchBtn }`) rather than triggering global repaints.
**Action:** Always provide explicit visual loading feedback (like an animated spinner or button disable state) on primary action buttons that trigger external API requests. Ensure third party UI manipulators only operate on the changed DOM node.
