## 2024-05-19 - Batching DOM insertions in long lists
**Learning:** Rendering a large list of elements (like 300 radio stations) by appending them one-by-one to the live DOM causes severe layout thrashing and slows down rendering. Also, loading hundreds of images eagerly degrades initial load time.
**Action:** Use `DocumentFragment` to batch DOM insertions into a single operation, and add `loading="lazy"` to images in long lists to defer loading until they enter the viewport.
