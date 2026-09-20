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

Pull requests are welcome.  
For major changes, please open an issue first to discuss what you would like to change.

## 🧭 Project status and history

PearBoard was created by **Rohan Chaudhary** ([@Codesamp-Rohan](https://github.com/Codesamp-Rohan)) in September 2025. His last commit was on 7 November 2025, on the `UI/improvingUI` branch, which was never merged.

Since **September 2026** the project is maintained by [@storytellerjr](https://github.com/storytellerjr). This repository carries the complete original history — all 43 of Rohan's commits, with his authorship intact — plus every branch and pull-request head from the original repository, including one whose branch had been deleted upstream.

Development continues from `UI/improvingUI`, where the original author left off. 🚧

### Changes from the original

As required by Apache-2.0 §4(b), significant changes are recorded here.

- **Sep 2026** — Added the `LICENSE` and `NOTICE` files that the original project never had; resolved the original's contradictory licence declaration (see below). Repository moved to a new home under active maintenance.

## 📜 License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

> **On the licence.** The original repository declared its licence two different ways: `package.json` said `Apache-2.0`, while this readme said MIT and linked to a `LICENSE` file that was never committed — in any branch, in any commit. With the original author uncontactable, this project follows **Apache-2.0**: it is the declaration carried in `package.json` across the entire history, and it is the stricter of the two, so the original author's terms are honoured under either reading. Nothing has been relicensed; Rohan Chaudhary's copyright is retained in `NOTICE`.