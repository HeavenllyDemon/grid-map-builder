# Grid Map Builder

A local-first 2D tile map editor for building maps from your own sprites and exporting them as text files where each tile is a single alphanumeric character.

Projects live entirely in your browser IndexedDB. There is no account, backend, or cloud sync.

## Download and Use

1. Install Node.js 20 or newer from <https://nodejs.org/>.
2. Open the latest GitHub release.
3. Download `grid-map-builder-portable-vX.Y.Z.zip`.
4. Unzip it anywhere you want to keep the app.
5. Start it:
   - Terminal: `npm run start`
   - macOS: double-click `start.command`
   - Windows: double-click `start.bat`
   - Linux: run `./start.sh`
6. The app opens at `http://127.0.0.1:58137`.

Keep using the same local address, `http://127.0.0.1:58137`, between versions. Browser data is attached to that address, so your projects stay available when the package files are updated.

## Updates

The portable package checks GitHub Releases from the app UI.

- When a newer release is available, click the update button.
- After the download finishes, click restart.
- The local server restarts, replaces the package files, and reloads the app.
- Use the Stop button in the header when you want to shut down the local server from the UI.
- Your project data is not inside the package folder. It remains in browser IndexedDB for `127.0.0.1:58137`.

You can also manually update by unzipping a newer portable package over the previous package folder. Use the same start script and the same fixed local address.

## Build From Source

Install Node.js 20 or newer first.

```bash
git clone https://github.com/HeavenllyDemon/grid-map-builder.git
cd grid-map-builder
npm ci
npm run dev       # http://localhost:5173
npm run build     # produces ./dist
npm run preview   # serves the production build locally
```

To run the same fixed-origin local server used by the portable package:

```bash
npm run build
npm run start
```

To create release assets locally:

```bash
npm run package:release
```

That writes:

- `release/grid-map-builder-portable-vX.Y.Z.zip`
- `release/grid-map-builder-update-vX.Y.Z.tgz`
- `release/checksums.txt`

## Using the App

**Library screen** is your project list.

- **New Project** creates a project with a chosen grid size and tile size.
- Each card shows a thumbnail, dimensions, and last-modified time.
- The card menu has Rename, Duplicate, and Delete.

**Editor screen**

- Add sprites by uploading or dropping image files.
- Matching tile-size images are added directly; other sizes open the crop tool.
- Select a sprite, then click or drag on tiles to paint.
- Use right-click drag to paint a rectangle.
- Use Eraser to clear tiles.
- Pan with middle mouse or Space + drag. Wheel zooms on the cursor.
- Export assigns one character per used sprite and downloads a `.txt` map.

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `B` | Brush tool |
| `E` | Eraser tool |
| `Esc` | Deselect sprite |
| `0` | Fit map to screen |
| Space + drag | Pan |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + S` | Force save |
| `Cmd/Ctrl + E` | Open export modal |

### Export Format

One character per tile, rows separated by `\n`. Sprite characters are alphanumeric; empty tiles use the empty-tile character, default `.`.

```text
AABBB.
AABBBC
.....C
```

## Storage and Privacy

Everything is local to your browser:

- Projects, sprites, and tile placements: IndexedDB
- Sprite image bytes: PNG blobs in IndexedDB

Clearing site data for `127.0.0.1:58137` wipes your projects. No user data is committed to this repo or included in release packages.

## License

MIT
