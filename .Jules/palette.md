## 2023-10-27 - Focus Visible
**Learning:** For accessibility compliance, the project uses `:focus-visible` (instead of `:focus`) in CSS for interactive elements (`button`, `a`, `[role="button"]`) to support keyboard navigation without showing unwanted outlines for mouse users.
**Action:** Add `:focus-visible` to interactive elements.
## 2023-10-27 - Label Association and ARIA Labels
**Learning:** HTML forms in custom vanilla UI may leave `<label>` orphaned and icon buttons lacking `<button aria-label="">` and `title=""`.
**Action:** Add `for` to `<label>` to map to inputs by ID. Add `aria-label` and `title` to custom symbol buttons.
## 2026-10-18 - Disconnected Labels in Custom Skins
**Learning:** When building complex custom UIs (like DJ/Retro modes), standard HTML input types like ranges and text searches often lose structural label connections (either no `<label>` or lacking a `for` attribute), severely hurting accessibility for screen readers navigating these advanced modes.
**Action:** Always ensure that custom skins map standalone inputs back to explicit labels using `for` or directly attach an `aria-label` to ensure robust keyboard/assistive navigation.
