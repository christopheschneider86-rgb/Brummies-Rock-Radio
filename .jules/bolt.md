## 2026-10-08 - [DocumentFragment Batching in Vanilla JS rendering]
**Learning:** In vanilla JavaScript applications without a framework, directly appending elements to the DOM within loops (like rendering station lists) causes significant layout thrashing and repaints.
**Action:** Use `DocumentFragment` to batch DOM insertions in memory and append them all at once to minimize reflows.
