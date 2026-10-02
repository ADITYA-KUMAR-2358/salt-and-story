# Lint exceptions

The frontend is linted with Oxlint (`npm run lint`, zero warnings allowed). It is used instead of
typescript-eslint because typescript-eslint does not support TypeScript 7 yet.

Rules switched off in `.oxlintrc.json`, and why:

| Rule | Why it is off |
| --- | --- |
| `react/set-state-in-effect`, `react/exhaustive-effect-dependencies` | React-Compiler-style advice. Our effects deliberately sync with timers, polling, the URL and "reset when X changes"; each was reviewed. |
| `jsx-a11y/prefer-tag-over-role` | Stylistic. The ARIA roles used (`region`, `group`, `status`, `img`) are valid and tested with the keyboard. |
| `jsx-a11y/media-has-caption` | Audio is narration of text already shown on the page, or the user's own recording. |
| `react/iframe-missing-sandbox` | A sandbox blocks the browser's PDF viewer; the iframe only shows our own generated PDF blob. |
| `import/no-unassigned-import` | CSS and font imports are side-effect imports by design. |

Single-line exceptions in the code carry a reason next to them (`oxlint-disable-next-line rule -- reason`).
