# GoldSrc Decal (Web)

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

- Flood-fill background cutout (`white` / `blue` / custom `R,G,B` / `alpha`).
- Median-cut 256-color palette, reserved index `255` as the transparency slot.
- 4-level mip chain at sizes that are multiples of 16.
- Decal size budgeted to match your game's texture cache
  (Sven Co-op 2 MB / 4 MB / 16 MB, HL 1.1 / CS 1.6, or a custom pixel cap).
- Emits the exact WAD3 byte layout GoldSrc expects
  (header `"WAD3"` + 1 lump of type `'C'` + texture block + mips + palette).

## Where to put the WAD

Copy `tempdecal.wad` into your game folder (the one containing `hl.exe`):

| Game          | Folder                              |
| ------------- | ----------------------------------- |
| Sven Co-op    | `<Game Folder>\svencoop`            |
| Half-Life     | `<Game Folder>\valve`               |
| CS 1.6        | `<Game Folder>\cstrike`             |

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

## License

Released under the [MIT License](LICENSE). Copyright © 2026 BaakWu.
Note: Half-Life, Half-Life 1, Counter-Strike, and Sven Co-op are trademarks of
their respective owners; this project is an independent, unofficial compatibility
tool and is not affiliated with or endorsed by them or by Valve.
