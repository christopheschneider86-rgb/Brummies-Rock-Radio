## 2025-02-18 - Batch DOM Appends with DocumentFragment
**Learning:** Appending hundreds of nodes individually to the DOM inside loops (like generating station lists) forces synchronous reflows on each append, causing a significant layout thrashing bottleneck.
**Action:** When rendering long lists (like `stationsListEl` or `djStationList`), append newly created elements to a `DocumentFragment` first. Append the fragment to the DOM once the loop finishes to limit DOM operations and improve render performance.
