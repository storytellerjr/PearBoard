# 🍐 Using PearBoard

A peer-to-peer whiteboard. Draw with other people in real time, with no server
in the middle — the boards live on the machines of whoever is looking at them.

---

## Starting a board

1. **Create** → type a name → **Add Name**
2. The board opens, and its **Canvas Topic** key appears in the menu

That key *is* the board. Anyone with it can join.

### Inviting someone

1. Click **Canvas Topic** — this copies the full key to your clipboard
2. Send it to whoever you want on the board
3. They paste it into **Canvas Topic!!!** and click **Join**

> ⚠️ **Click to copy — don't read the key off the screen.** It is shown
> shortened, and a partial key will not work.

You will see their cursor move as they draw, and they will see yours.

---

## 🖱️ Selecting and moving: click the pointer first

**This is the one thing worth knowing before anything else.**

To move, resize or delete something, first click the **pointer tool** (the arrow,
first in the toolbar) — or press **`V`**.

Only then does the board respond to what is under your mouse:

| What you do | What happens |
|---|---|
| Hover a shape | It outlines faintly, and the cursor becomes a **four-way cross** |
| Click it | The outline turns solid and its properties open on the left |
| Drag it | It moves |
| Drag a corner or edge | It resizes, with the opposite side staying put |
| Press **Delete** | It is removed |
| Click empty board | Nothing is selected any more |

**With a drawing tool active, hovering does nothing** — and that is deliberate.
With the pen selected, a click means "start drawing here", so showing a move
cursor would promise something that is not going to happen. The tool you pick is
how you tell the board whether you mean to draw or to handle what is already
there.

This is how Excalidraw behaves, and for the same reason.

Selecting something puts a **thin blue frame** around it with a white square at
each corner. Those corners, and the middle of each side, are the eight points you
can drag to resize — the cursor turns into a double-headed arrow to show which
way each one goes.

> 💡 **Shortcut:** holding **Shift** lets you drag an object without switching
> tools. Useful for nudging one thing mid-drawing.

---

## 🧰 The tools

| Tool | Key | What it does |
|---|---|---|
| Pointer | `V` | Select, move and delete |
| Pen | `P` | Freehand drawing |
| Eraser | `E` | Rub out strokes |
| Arrow | `A` | Arrows that attach to shapes |
| Line | `L` | Straight lines |
| Rectangle | `R` | Boxes |
| Ellipse | `O` | Circles and ovals |
| Diamond | `D` | Diamonds |
| Text | `T` | Type on the board |
| Icons | — | Your icon libraries |

**Undo** is `Cmd/Ctrl + Z`, **redo** is `Cmd/Ctrl + Shift + Z`.
Hold **Space** and drag to pan. Scroll to zoom.

---

## ➡️ Arrows that stay attached

Arrows are placed with two clicks: **click where it starts, move, click where the
head goes.** The line follows your pointer in between. Dragging works too.

Move the mouse near a box, circle or diamond and **four anchor points appear** on
its edges. The nearest fills in solid — release there and the arrow attaches.

Once attached, **the arrow belongs to that shape.** Move the box and the arrow
follows it. Rearrange a diagram and the connections hold.

Press **Escape** to abandon an arrow part-way.

Three shapes, chosen in the properties panel: **straight**, **curved**, and
**elbow** (right-angled).

---

## 🎨 The properties panel

Pick a tool, or select something, and the panel opens on the left showing only
what applies to it.

- **Stroke** — five colours, or any colour via the picker
- **Background** and **Fill** — transparent or a colour, filled solid, hachure or
  cross-hatch
- **Stroke width** — thin, medium, bold
- **Stroke style** — solid, dashed, dotted
- **Sloppiness** — how hand-drawn the line looks, from ruled to loose
- **Edges** — sharp or rounded corners
- **Opacity** — 0 to 100
- **Layers** — send an object behind or in front of the others

Change something with an object selected and it applies to that object. Change it
with nothing selected and it becomes the default for what you draw next.

Text also gets **font family** (hand-drawn, normal, code), **size** and
**alignment**.

---

## 🖼️ Icon libraries

The **gallery** button opens the icons. **Drag one onto the board** and it lands
where you drop it.

### Bringing in your own

1. Click **+** beside the library dropdown
2. Name it and describe it → **Create**
3. Choose your image files

They import, and from then on drag onto the board like any other icon. Switch
libraries from the dropdown; **Add icons…** brings more in later.

> ⚠️ **Imported icons are yours alone for now.** Other people on the board will
> not see them yet — sharing them between peers is still being built. The icons
> bundled with PearBoard work for everyone.

---

## 💾 Saving

**Your work saves itself.** A second or so after you stop drawing, a small
**Saved** appears in the bottom right. Close the window and rejoin the same
board, and your drawing comes back.

You can also save a **named snapshot** with the save-state button, and reopen any
earlier one from the list — useful for keeping a version before you rework
something.

---

## 🤔 If something seems wrong

**Hovering does nothing** — the pointer tool is probably not selected. Press `V`.

**My icon does not appear for anyone else** — imported icons do not reach peers
yet. Use the bundled ones for shared boards.

**The board is empty after rejoining** — anything drawn before auto-save existed
was never stored. Boards drawn since will come back.

**The app will not start** — PearBoard cannot run from a folder whose path
contains a space. Move it somewhere without one.

---

## ⚡ Supporting the work

PearBoard is free, open source, and has no servers behind it — just peers. If it
is useful to you, see the **Support the development** section in the readme. 🧡
