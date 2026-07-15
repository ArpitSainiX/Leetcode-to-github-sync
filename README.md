# LeetCode to GitHub Sync

A Chrome extension that **automatically pushes your accepted LeetCode solutions** to a GitHub repository. Every time you get an "Accepted" verdict, the extension extracts your code and commits it to your configured GitHub repo — no manual copy-pasting.

## How It Works

```
You solve a problem on LeetCode
        │
        ▼
Extension intercepts the submission check response (fetch/XHR)
        │
        ▼
Detects "Accepted" status (status_code === 10)
        │
        ▼
Extracts code from the Monaco editor
        │
        ▼
Pushes to your GitHub repo via API
        │
        ▼
✅ Solution on GitHub
```

### Technical Architecture

| Layer | File | Role |
|---|---|---|
| Content Script | `content.js` | Injects into LeetCode page, shows status badge, bridges messages |
| Injected Script | `injected.js` | Runs in page's MAIN world via `chrome.scripting.executeScript(world: "MAIN")`. Patches `window.fetch` and `XMLHttpRequest` to intercept submission check responses |
| Background Worker | `background.js` | Service worker. Injects the script on demand, handles GitHub API calls |
| Popup | `popup.html` / `popup.js` | Quick settings UI for GitHub token, repo owner, repo name |
| Options | `options.html` / `options.js` | Full settings page with "Test Connection" button |

**Key design decisions:**

- **Network interception over DOM scraping** — Instead of watching for "Accepted" text in the DOM (fragile, breaks when LeetCode redesigns), the extension intercepts the actual API response from LeetCode's `/submissions/detail/{id}/check/` endpoint. This is immune to UI changes.
- **`chrome.scripting.executeScript` with `world: "MAIN"`** — Injects the fetch/XHR patcher directly into the page's JavaScript environment, bypassing Content Security Policy restrictions that would block `<script>` tag injection.
- **CustomEvent bridge** — The injected script (MAIN world) communicates back to the content script (ISOLATED world) via DOM `CustomEvent`, which reliably crosses Chrome's world boundary.
- **`/v2/check/` URL support** — Handles LeetCode's current API URL structure which includes a version segment in the check endpoint.

## Features

- ✅ Automatically detects accepted submissions
- ✅ Supports both **leetcode.com** and **leetcode.cn**
- ✅ Works with all LeetCode-supported languages (Python, Java, C++, JavaScript, Go, Rust, etc.)
- ✅ File naming: `{problem-slug}/{problem-slug}.{ext}` (e.g., `two-sum/two-sum.py`)
- ✅ Each commit adds a header with problem title and timestamp
- ✅ Deduplicates — won't push the same code twice
- ✅ Works even if LeetCode changes their UI
- ✅ No LeetCode credentials needed — uses your existing login session

## Installation

### Prerequisites
- Google Chrome (version 111+ for `world: "MAIN"` support)
- A GitHub account
- A GitHub repository (create one at `github.com/new`)

### Step 1: Load the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `leetcode-to-github` folder
5. The extension appears in your toolbar

### Step 2: Generate a GitHub Personal Access Token

1. Go to `https://github.com/settings/tokens`
2. Click **Generate new token (classic)**
3. Give it a name like `leetcode-sync`
4. Under **Scopes**, check **`repo`** (full control of private repositories)
5. Click **Generate token**
6. **Copy the token** — it starts with `ghp_` or `github_pat_`. You won't see it again.

### Step 3: Configure the Extension

1. Click the extension icon in the Chrome toolbar
2. Enter:
   - **GitHub Token** — the PAT from step 2
   - **Repository Owner** — your GitHub username (e.g., `your-username`)
   - **Repository Name** — the repo name (e.g., `leetcode-solutions`)
3. Click **Save Settings**

To verify everything works, open the **Options** page (right-click the extension icon → "Options" or click "Advanced Settings" in the popup) and click **Test Connection**.

## Usage

1. Go to any LeetCode problem page (`https://leetcode.com/problems/...`)
2. Look for the **purple badge** in the top-right corner:
   - `starting...` → extension loaded
   - `injected ✓` → network patcher active
3. Write your solution and click **Submit**
4. When the verdict is "Accepted", the badge updates:
   - `pushing...` → sending to GitHub
   - `PUSHED ✓` → successfully committed
   - `push failed` → check the console for details

## Repository Structure

Your GitHub repo will look like:

```
leetcode-solutions/
├── two-sum/
│   └── two-sum.py
├── reverse-linked-list/
│   └── reverse-linked-list.cpp
├── valid-parentheses/
│   └── valid-parentheses.java
└── ...
```

Each file includes a header:

```python
# LeetCode Solution: Two Sum
# Submitted: 2026-07-15T13:45:00.000Z
# Language: python3

class Solution:
    def twoSum(self, nums, target):
        ...
```

## Development

### Project Structure

```
leetcode-to-github/
├── manifest.json          # Extension manifest (MV3)
├── content.js             # Content script (ISOLATED world)
├── injected.js            # Network patcher (MAIN world)
├── background.js          # Service worker
├── popup.html             # Quick settings popup
├── popup.js
├── options.html           # Full settings page
├── options.js
├── styles.css             # Shared styles
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Debugging

Open **DevTools (F12) → Console** on a LeetCode problem page and filter for `[LC2GitHub]` to see detailed logs:

```
[LC2GitHub] Patching fetch...
[LC2GitHub] Patching XHR...
[LC2GitHub] intercepting check: https://leetcode.com/submissions/detail/123/v2/check/
[LC2GitHub] check response: state=success msg=accepted code=10
[LC2GitHub] ACCEPTED! Submission ID: 123
[LC2GitHub] Problem: Two Sum | Lang: python3 | Code length: 312
[LC2GitHub] Pushed to GitHub: https://github.com/...
```

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Badge says "inject failed" | `chrome.scripting` permission missing or Chrome version < 111 | Update Chrome, check permissions on `chrome://extensions` |
| No badge at all | Content script not matching URL | Ensure you're on `https://leetcode.com/problems/*` |
| `fetch:` lines appear but no `>>> Intercepting check:` | URL doesn't contain `/submissions/` and `check` | Open an issue with the actual URL shown in the log |
| Badge says "push failed" | GitHub token invalid, expired, or missing `repo` scope | Regenerate token with `repo` scope |
| "Not configured" in popup | Token/owner/repo not saved | Open popup, fill in fields, click Save |
| Pushes but wrong code | Code extracted after user modified editor | Submit again without modifying the code |

## Limitations

- Only works on `leetcode.com` and `leetcode.cn` (not other mirrors)
- Requires Chrome 111+ for `world: "MAIN"` support
- Pushes the code currently in the editor at the time of detection (not the exact submitted version)
- No support for LeetCode's built-in "Notes" or multiple-file solutions

## License

MIT — free to use, modify, and distribute.
