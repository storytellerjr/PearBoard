# Build log

Every change ships in a numbered build. The number is the time it was cut, shown
in red in the corner of the app while running in dev mode, so it is always
possible to tell which build a window is running — testing a window opened
before a fix looks exactly like the fix not working.

Newest first. At the end of a development day this is what release notes are
written from.

---

## 20 September 2026 — taking the project over

### 18:06 · Canvas types
Four papers, chosen from the board bar and remembered per board: **Dots** (as
before), **Lines** for handwriting with a margin rule, **Plain paper** with
nothing on it, and **Storyboard** — a header band for a title and log line, then
rows of faint panels with a circle at each lower left for a shot number.

Changing the paper changes only the background. Nothing drawn is touched, so
switching is always safe.

### 17:43 · Bottom edge stacked
`898a98a` — The board bar and the tool icons were both pinned to the bottom
centre, so the board's name sat over the squares and circles. Bottom edge now
stacks: bar at 10px, tools at 56px, both tightened on a short window.

### 17:41 · The way out, where it can be found
`db5204c` — Boards and Exit moved out of the options panel behind the gear, into
a small bar at the bottom of every board showing the board's name. Duplicates
behind the gear removed. Build stamp moved to the top-right, clear of the macOS
window buttons and the zoom readout. Zoom by keyboard: `⌘ +`, `⌘ −`, `⌘ 0`.

### 16:46 · Navigation and a panel that names itself
`6351e37` — Boards returns to the room list, Exit closes the app; both save
first and tear the swarm down. `initializeRoomList()` split so refreshing does
not bind a second click handler. The panel heading follows the selection — Pen
settings, Box settings, Arrow settings — instead of always saying "Stroke
Settings".

### 16:12 · Tabs, opacity, toolbar
`44a5506` — Properties split into **Stroke** and **Background** tabs, with
opacity and layers under both. Images gain a stroke of their own, meaning a
frame around them. Icon backgrounds show through white artwork by drawing in
`multiply`. Background fill honours opacity. Toolbar wraps and centres so it
survives a short window. Icon library closes on an outside click.

### 15:48 · Images as first-class objects
`5c8b5e7` — Images take background, fill, edges, font, size and alignment;
their text is a caption low inside the box. Dropping an image selects it. Text
alignment wired to labels, not just free text.

### 15:09 · Text inside shapes
`c721be8` — Double-click a box, circle, diamond or arrow and type. Centred,
wrapped, re-wraps on resize. Editor chrome removed so typing looks like writing
on the board. Thin objects made clickable and given a visible frame.

### 14:49 · Resize handles
`96c9f44` — Selection frame with corner handles; drag a corner or edge to
resize. Fixed clicking to select, which threw on every mousedown because the
handle code was called on the wrong class.

### 14:21 · Cursors and hover
`641c55f`, `78e49aa` — Each tool has its own cursor. Fixed hover being silently
undone by a second mousemove handler, and a pan flag that stuck and blocked
hover entirely.

### 13:56 · A softer line
`d7f95cc` — Stroke widths down to 1 / 2 / 4. The hand-drawn second pass is
thinner and fainter, so doubling reads as texture rather than a heavy line.

### 13:23 · Hand-drawn shapes
`fb8d089`, `64f41fb`, `0eb1b8a` — Background and fill, rounded edges, a bundled
open hand-drawn font, pen pressure, and drawing defaults. Fixed every shape
drawing itself twice, caused by rotating about the canvas origin instead of the
shape's centre.

### 12:37 · Arrows and selection
`b1e7a98`, `fef6bad` — Arrow tool binding to shapes' anchor points, so moving a
box moves its arrows. Pointer tool for select, move and delete.

### 12:22 · Icon libraries
`49cb545` — Import your own icons into named libraries. Fixed typing: space was
swallowed globally, so no text field accepted one.

### 11:05 · It runs
`d7ff0d9`, `bcef6b6` — Restored the storage layer, which was gitignored and
never committed, so the app could not start from a clean clone. Then wired up
the features that were built but never connected: text that deleted itself,
images never drawn, an icon library that was dead code.

### Handover
`b975798`, `911897c`, `abd92fb` — LICENSE and NOTICE the project never had, the
Apache-2.0 resolution, Rohan credited, Lightning address for support.
