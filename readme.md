# 🍐 PearBoard

**PearBoard** is a peer-to-peer (P2P) collaborative whiteboard built using [Pear](https://holepunch.to/) technology.  
It allows multiple users to connect directly, draw together in real-time, and share ideas without relying on centralized servers.

---

![Alt text for image](./assets/productImage.png)

---

## ✨ Features

- 🎨 Real-time drawing with pen, shapes, text, and eraser
- 🖱️ Mouse follower to see peers' cursors live
- 🔁 Undo and redo support
- 📡 Peer-to-peer connectivity powered by Pear
- 🧑‍🤝‍🧑 Multi-peer support for collaborative sessions
- 🚀 No servers required — all communication is direct

---

## 🛠 Tech Stack

- **Pear** (Holepunch stack: Hypercore, Hyperswarm)
- **JavaScript, HTML, CSS**
- **Canvas API** for rendering drawings
- **Live Collaboration**

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/storytellerjr/PearBoard.git
cd PearBoard

# Install dependencies
npm install

# Run the development server
npm run dev
or
pear run -d .
```

## 🚀 Usage

1. Run `npm run dev` to launch PearBoard locally.
2. Share your **Canvas Room Key** with collaborators.
3. Once connected, everyone’s strokes, shapes, and mouse positions will sync in real time.  

## 🎯 Roadmap

- [ ] File and image upload support
- [ ] Voice and video chat integration
- [ ] Persistent boards (save and load sessions)
- [ ] Improved UI with color palettes and toolbars

## Join Room

Join the 
```bash
pear://keet/yfoik1wj341giyzf7tyr5efkyfdtrtfugamgw476muitdyfug6np4hcheycra1marpmuynsag6dpmy46gxawdu7pxd8kri1936euegcm1miqd6jm7gw3dwr99k69js1eihftwi8jrphozbxmgdzrgg4wop3t4ye to discuss about the PearBoard.
```

## 🤝 Contributing

Pull requests are very welcome! 🙌  
For major changes, please [open an issue](https://github.com/storytellerjr/PearBoard/issues) first so we can talk it through.

Not a coder? There's plenty else that helps: 🐛 report a bug, 💡 suggest a feature, 🎨 send design ideas, or ⭐ star the repo so others find it.

## ⚡ Support the development

PearBoard is free, open source, and has no servers behind it — just peers. 🍐  
If it's useful to you and you'd like to help it keep growing, you can send a few sats over Lightning:

```
blink.sv/storyteller
```

👉 **Please put `PearBoard` in the payment message**, so I know which project the support is for. 🧡

Every sat goes straight into development time — new features, bug fixes, and keeping the boards drawing smoothly. Thank you! 🙏

## 🧭 Project status and history

PearBoard was created by **Rohan Chaudhary** ([@Codesamp-Rohan](https://github.com/Codesamp-Rohan)) in September 2025. 🍐 In about seven weeks he built the whole thing — the canvas, the peer-to-peer syncing, the live cursors, the undo/redo, the toolbar — and shared it openly with everyone.

Rohan stepped away from the project around **November 2025**. His last commit was on 7 November 2025, on the `UI/improvingUI` branch, which was never merged.

### 🙏 Thank you, Rohan

This project exists because Rohan built it and chose to release it openly. Every good idea in here started with him, and his name stays on all 43 of his commits — where it belongs. Wherever you are now: thank you, and we hope you like where it goes next. 🧡

### 🚀 Where it goes from here

Since **September 2026** the project is maintained by [@storytellerjr](https://github.com/storytellerjr), picking it up exactly where Rohan left it.

This repository carries the complete original history — all 43 of Rohan's commits, with his authorship intact — plus every branch and pull-request head from the original repository, including one whose branch had been deleted upstream. Nothing of his work was lost in the handover.

Development continues from `UI/improvingUI`, the branch he was working on when he stopped. 🚧

### Changes from the original

As required by Apache-2.0 §4(b), significant changes are recorded here.

#### September 2026 — the app runs again

The project could not start from a clean clone. `storage/` was listed in `.gitignore`, so the two modules `app.js` imports on its first lines were never committed. The imports failed, `app.js` never executed, and no event listener was ever attached — the setup screen rendered and no button did anything. Fixing that uncovered a series of features that had been built but never wired up.

**Made it start**
- Reconstructed `storage/AppState.js` and `storage/GlobalState.js` from their call sites, and removed `storage/` from `.gitignore` so it cannot happen again
- Corestore is now created once and shared, rather than a second instance fighting the first over Hypercore's file locks

**Text that stays put**
- Committing a text object read `.textContent` from a `<textarea>`, where typed input lives in `.value`. Every commit therefore saw an empty string and deleted the object the user had just typed into

**Images on the board**
- The renderer had no `case 'image'`, so inserted icons were added to the document and never drawn
- A colourless object threw inside `addAlphaToColor()` and broke the render loop for *everything* — one icon would have stopped the whole canvas drawing
- Icons scale to 180px on their longest side, keeping their proportions, instead of arriving at their full 768x1344

**A working icon library**
- `loadIcons()` returned `undefined` while rendering its own throwaway images into the panel. `displayIcons()` read `.length` on that undefined and threw, so the real list — with all its handlers — never ran. It now returns a promise for the filenames and leaves rendering to the caller
- The panel is styled for the first time, and clears itself before repopulating instead of stacking duplicates

**Drag and drop**
- Icons are dragged onto the board and land where they are dropped, tracked with pointer events so it works with a mouse, a trackpad or a touchscreen

**Arrows that stay attached**
- An arrow tool: click where it starts, watch the line follow the pointer, click where the head goes. Dragging works too
- Straight, curved and elbow arrows
- Hover any box, circle or diamond and its four anchor points appear; both ends of an arrow snap to the nearest one
- Arrows bind to *what* they point at, not to a position — move the shape and the arrow follows

**Shapes that look drawn by hand**
- Background and fill (hachure, cross-hatch, solid), rounded or sharp edges
- The hand-drawn look comes from each edge being its own slightly bowed line that overshoots its corners, stroked twice — not from jittering points, which reads as noise
- Sensible defaults: a soft green box with a black outline and rounded corners

**Text with a real hand-drawn font**
- Architects Daughter is bundled (SIL Open Font License), so a board renders correctly with no network — this is a peer-to-peer app
- Three families, four sizes, and alignment; the editor uses the same font as the canvas, so what you type is what you get
- Multi-line text renders as multiple lines, which it did not before

**Shape properties**
- Colour swatches, three stroke widths, solid/dashed/dotted, three sloppiness levels, opacity, and layer ordering
- Properties apply to new shapes and to the current selection
- Sloppiness is seeded from the object's id, so a shape wobbles identically on every frame and on every peer's screen

**Select and move things**
- A pointer tool: hover to highlight, click to select, drag to move, Delete to remove — on strokes, shapes, text and icons alike
- Object dragging already existed but was hidden behind holding Shift, with no outline drawn and no way to discover it. Shift-drag still works with any tool

**Your own icon libraries**
- Icons can be imported from a local folder into named libraries with a description, and switched between in the panel
- Imported art is scaled to 512px on its longest side on the way in
- Placed icons reference a library and icon id rather than a file path — a path only ever resolves on the machine that made it, so it could never have reached a peer or survived the folder being moved
- Peer sharing of imported icons is not built yet; they work on your own boards

**Typing works everywhere**
- Space was swallowed globally to stop the page scrolling, and single-key tool shortcuts fired regardless of focus, so no text field on the board accepted a space and `e` switched to the eraser mid-word

**Work that survives closing the window**
- Auto-save on a debounce after drawing stops, and on window close
- Boards restore automatically when rejoining a room
- Auto-saves use their own slot, so hand-saved snapshots are untouched

**Licensing**
- Added the `LICENSE` and `NOTICE` files the original never had, and resolved its contradictory licence declaration (see below)

## 📜 License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

> **On the licence.** The original repository declared its licence two different ways: `package.json` said `Apache-2.0`, while this readme said MIT and linked to a `LICENSE` file that was never committed — in any branch, in any commit. With the original author uncontactable, this project follows **Apache-2.0**: it is the declaration carried in `package.json` across the entire history, and it is the stricter of the two, so the original author's terms are honoured under either reading. Nothing has been relicensed; Rohan Chaudhary's copyright is retained in `NOTICE`.