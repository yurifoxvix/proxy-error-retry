# proxy-error-retry

A simple extension for SillyTavern. Install it, and it will intercept any proxy error message you designate, stop the response, and swipe for you automatically, up to a set number of attempts.

## Install

1. In SillyTavern, open the **Extensions** panel (stacked-blocks icon).
2. Click **Install extension**.
3. Paste this repo's URL and confirm.

## Settings

Found in the Extensions panel under **Proxy Error Auto-Swipe**.

- **Match text:** the text that triggers a retry. Defaults to `proxy error` (case-insensitive).
- **Treat as regex:** enable for pattern matching. For example, `Proxy error \(HTTP \d{3}` matches only the proxy's error header line.
- **Max retries:** the maximum number of swipes before it gives up (default 10).
- **Delay before swipe:** the wait in milliseconds between retries (default 1000).

## Notes

- Works on streamed responses, and also catches errors that arrive as a finished message.
- The retry counter resets after any clean response.
- The stopped error message stays in your swipe history; delete it manually if you like.
