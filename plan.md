1. **Identify the vulnerability:** The vulnerability is `window.open` using `_blank` without `noopener` / `noreferrer` which allows reverse tabnabbing and opens up security risks.
2. **Apply the fix in `app.js`:** Update line 1976 from `window.open(\`https://www.google.com/search?q=\${query}\`, '_blank');` to `window.open(\`https://www.google.com/search?q=\${query}\`, '_blank', 'noopener,noreferrer');`
3. **Pre commit step:** Ensure all verifications, tests, review and reflection are done.
4. **Submit:** Submit the pull request.
