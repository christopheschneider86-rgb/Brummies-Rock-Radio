## 2023-10-27 - Focus Visible
**Learning:** For accessibility compliance, the project uses `:focus-visible` (instead of `:focus`) in CSS for interactive elements (`button`, `a`, `[role="button"]`) to support keyboard navigation without showing unwanted outlines for mouse users.
**Action:** Add `:focus-visible` to interactive elements.

## 2026-10-14 - Form Accessibility
**Learning:** To support screen readers properly when using custom inputs like sliders or when the `<label>` tag is a separate div/element, explicit `for` attribute referencing the `id` of the input must be used, or `aria-label` attributes must be applied directly to the `<input>` elements.
**Action:** Add `for` attribute to link label to inputs, or `aria-label` on the input element if a separate label component can not be linked.
