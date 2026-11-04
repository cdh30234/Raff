# Edge-Drop — macOS port

Unofficial macOS (Apple Silicon) port of Edge-Drop 0.4.0. Original project: https://github.com/Deepender25/Edge-Drop (Apache-2.0).

## What changed
- `electron/main/macNative.ts` (new): talks to macOS directly through koffi + the Objective-C runtime:
  NSPasteboard changeCount (detects copies), reading/writing copied files (Finder),
  the frontmost app (to return focus), and pressing ⌘V via CGEvent.
- `formats.ts`: detects copies and copied files on Mac.
- `ipc.ts`: paste sends ⌘V; copying files puts real files on the clipboard (Finder can paste them).
- `window.ts`: the window is a non-activating NSPanel above full-screen apps and on every desktop (Space); focus returns to the previous app before pasting.
- `index.ts`: no Dock icon (menu-bar app). `tray.ts`: menu-bar template icon.
- `loginItems.ts`: launch at login on Mac. `updater.ts`: updater off on Mac (no Mac update feed exists).
- UI text: Ctrl/Alt are shown as ⌘/⌥.
- `package.json`: `build:mac` script + `mac` settings (dmg + zip, arm64, ad-hoc signing, LSUIElement).

## Build
```bash
npm install
npm run build:mac
```
Output: `dist/Edge-Drop-0.4.0-mac-arm64.dmg` and `dist/mac-arm64/Edge-Drop.app`.

Run without packaging (development): `npm run dev`

## First run
1. The app isn't signed by Apple: right-click Edge-Drop.app → Open → Open (first time only),
   or: `xattr -dr com.apple.quarantine /Applications/Edge-Drop.app`
2. Clicking a card to paste asks for **Accessibility** permission:
   System Settings → Privacy & Security → Accessibility → turn on Edge-Drop, then restart it.
   (Without it, the item is copied and you press ⌘V yourself.)
3. Open the shelf: move the pointer to the left edge of the screen, or press ⌥ Option + C.

Note: after every rebuild, macOS may ask for the Accessibility permission again (the signature changes).
