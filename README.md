# GoldSrc Decal (Web)

Repository: [https://github.com/BaakWu/goldsrc-decal-web](https://github.com/BaakWu/goldsrc-decal-web)

A **single self-contained HTML file** that turns any PNG / JPG / JPEG / BMP
into a valid Half-Life 1 (GoldSrc) WAD3 spray (`tempdecal.wad`).

- **Use it:** open [`index.html`](index.html) — the whole app is in that one file,
  needs no server, and uploads nothing (your image never leaves your computer).
- **No server. No upload.** Everything runs in your browser via JavaScript.
- Open `index.html` (double-click) or serve it with any static server.
- Drag an image onto the drop zone, choose a strategy (or leave it on **auto**),
  pick a decal memory budget (2 MB / 4 MB / 16 MB cache presets or custom pixels),
  click **Build** and download the resulting `tempdecal.wad` + a checkerboard
  preview PNG.

## Features

- Flood-fill background cutout (`white` / `black` / `blue` / custom `R,G,B` / `alpha`).
- Median-cut 256-color palette, reserved index `255` as the transparency slot.
- 4-level mip chain at sizes that are multiples of 16.
- Decal size budgeted to match your game's texture cache
  (Sven Co-op 2 MB / 4 MB / 16 MB, HL 1.1 / CS 1.6, or a custom pixel cap).
- Emits the exact WAD3 byte layout GoldSrc expects
  (header `"WAD3"` + 1 lump of type `'C'` + texture block + mips + palette).

## Where to put the WAD

Copy `tempdecal.wad` into the folder shown for your game:

| Game          | Folder                          |
| ------------- | ------------------------------- |
| Sven Co-op    | `Sven Co-op\svencoop`           |
| Half-Life     | `Half-Life\valve`               |
| CS 1.6        | `Half-Life\cstrike`             |

To find the `<Game Folder>` containing the path above, open Steam → **Library**,
right-click the game and choose **Manage > Browse local files**.

Sven Co-op players should enable **Custom player sprays**
(Options → Multiplayer → Advanced…) and pick a cache size that fits the budget.
Set the file to **read-only** so the game doesn't overwrite your spray.
See the built-in instructions in `index.html` for full details.

## Tests

```
npm test
```

Runs the inline-script syntax checker, the core pipeline test, and a
cross-language WAD byte comparison (`test/`).

See [`index.html`](index.html) for the full pipeline and the layout the writer
enforces, and [`decal-core.js`](decal-core.js) for the DOM-free core.

## Privacy

**Image conversion stays on your device.** The tool runs entirely in the browser:

- Your image is read via local file access only (a local blob URL); it is never uploaded.
- The app code sets no cookies or persistent browser storage and embeds no analytics,
  advertising, tracking, third-party scripts, or CDN assets.
- `tempdecal.wad` and the preview PNG are generated locally and only leave your
  machine when you click the download buttons.
- The decal name you type is used only to name the output file; it is never stored or sent.
- Opening the hosted copy sends routine technical connection data, such as your IP address
  and HTTP headers, to Cloudflare for DNS and static hosting. This never includes your image,
  settings, decal name, or generated files. Opening the page locally needs no server.

See the complete, dated [Privacy Policy](index.html#privacy) for the Cloudflare disclosure.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 BaakWu.
Note: Half-Life, Half-Life 1, Counter-Strike, and Sven Co-op are trademarks of
their respective owners; this project is an independent, unofficial compatibility
tool and is not affiliated with or endorsed by them or by Valve.
