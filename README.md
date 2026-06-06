# Teams Media Favorites

Adds Discord-style **image / GIF favorites** to Microsoft Teams on the web.

## Features

| Feature | Description |
|---|---|
| ⭐ Chat favorites | Hover over an image or GIF in a chat message and a star button appears in the top-right corner — click to add to favorites, click again to remove |
| 🗂 Picker integration | Click the GIF button to open Teams' built-in picker; the first category tab is "Favorites" |
| 🖼 Local cache | Teams images are compressed into a local copy, so they don't turn into broken links once the original short-lived URLs expire |
| 🔄 Live sync | With Teams open in multiple tabs, favorite state syncs automatically; devices signed into the same browser account sync via Edge/Chrome extension sync |

## Installation

1. Download or clone this folder
2. Open Edge: `edge://extensions/` or Chrome: `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" → select this folder (`teams-gif-favorite-extension/`)
5. Open [teams.microsoft.com](https://teams.microsoft.com) or [teams.live.com](https://teams.live.com)

## Usage

### Favoriting an image or GIF
1. In any chat, hover over an image or GIF someone sent
2. A ☆ star button appears in the top-right corner → click it to turn it into ★ (favorited)
3. Click again to remove it from favorites

### Using your favorites
1. Click the GIF button in the message compose bar (the smiley / sticker icon)
2. Switch to the **GIFs** tab
3. The first category cell is ⭐ **Favorites**
4. Open it → see all your favorited images and GIFs → click one to insert it into the compose box

## Known limitations

- **The Teams desktop app is not supported** (a browser extension cannot inject into the native Teams app)
- Static images are stored as a compressed local copy; Teams / attachment GIFs keep their original animation when under 2MB; GIPHY / Tenor still prefer their stable URLs
- Cross-device sync relies on the browser's extension sync; only the favorites list is synced — compressed image copies are kept only on the current device
- If sync storage runs out, the favorites list automatically falls back to local storage
- If a Teams update changes the DOM structure, you may need to update the selectors in `src/content/selectors.js`
- The image / GIF insertion strategy depends on the Teams version; if automatic insertion fails, the image is copied to the clipboard automatically with a prompt to paste it manually

## Troubleshooting

Open DevTools (F12) → Console and filter by `[GifFav]` to see debug messages.

If a favorited image or GIF doesn't show up / the star doesn't appear, a Teams update may have broken the selectors. Run this in the DevTools Console:

```js
// Check that the content script is loaded
window.GifFav
```

If it returns `undefined`, the content script isn't loaded — make sure the extension is enabled and the domain matches.

If the `GifFav` object exists but the star doesn't appear, the selectors are broken. Inspect an image `<img>` element on a Teams chat page, find its `src` format, and update the `isImageImg` function in `selectors.js`.
