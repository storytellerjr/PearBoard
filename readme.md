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

- **Sep 2026** — Added the `LICENSE` and `NOTICE` files that the original project never had; resolved the original's contradictory licence declaration (see below). Repository moved to a new home under active maintenance.

## 📜 License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

> **On the licence.** The original repository declared its licence two different ways: `package.json` said `Apache-2.0`, while this readme said MIT and linked to a `LICENSE` file that was never committed — in any branch, in any commit. With the original author uncontactable, this project follows **Apache-2.0**: it is the declaration carried in `package.json` across the entire history, and it is the stricter of the two, so the original author's terms are honoured under either reading. Nothing has been relicensed; Rohan Chaudhary's copyright is retained in `NOTICE`.