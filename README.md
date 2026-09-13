# GoldSrc Decal (Web)

A **single self-contained HTML file** that turns any PNG / JPG / JPEG / BMP
into a valid Half-Life 1 (GoldSrc) WAD3 spray (`tempdecal.wad`).

- **No server. No upload.** Everything runs in your browser via JavaScript.
- Open `index.html` (double-click) or serve it with any static server.
- Drag an image onto the drop zone, choose a strategy (or leave it on **auto**),
  click **Build** and download the resulting `tempdecal.wad` + a checkerboard
  preview PNG.

## Features

- Flood-fill background cutout (`white` / `blue` / custom `R,G,B` / `alpha`).
- Median-cut 256-color palette, reserved index `255` as the transparency slot.
- 4-level mip chain at sizes that are multiples of 16.
- Emits the exact WAD3 byte layout GoldSrc expects
  (header `"WAD3"` + 1 lump of type `'C'` + texture block + mips + palette).

See [`index.html`](index.html) for the full pipeline and the layout the writer
enforces.
