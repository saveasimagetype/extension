# Save As Image Type

A lightweight Chrome/Brave extension that lets you right-click any image and save it as a different format.

## Supported Formats

| Format | Transparency | Notes |
|--------|-------------|-------|
| PNG | Yes | Lossless |
| JPEG | No (white fill) | Compressed, 92% quality |
| WebP | Yes | Modern format, small files |
| AVIF | Yes | Next-gen format, excellent compression |
| BMP | No (white fill) | Uncompressed bitmap |
| GIF | No (white fill) | Classic web format |

Works with **all source image types** including WebP, AVIF, SVG, PNG, JPEG, GIF, BMP, and TIFF.

## How to Use

1. Right-click any image on a webpage
2. Select **Save Image As…**
3. Pick your target format
4. Choose where to save

## Install

### Chrome Web Store

*Coming soon*

### Manual Install

1. Download or clone this repository
2. Open `chrome://extensions` (or `brave://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder

## Privacy

All image conversion happens **100% locally** in your browser. No data is collected or sent anywhere.

[Full privacy policy](https://saveasimagetype.github.io/extension/)

## Permissions

| Permission | Why |
|---|---|
| `contextMenus` | Adds the right-click menu options |
| `downloads` | Opens the browser save dialog |
| `activeTab` | Accesses the image on the current page when you right-click |
| `scripting` | Runs image conversion in the active tab |

## License

MIT
