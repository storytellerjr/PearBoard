/**
 * AppState — the live, in-memory state of a whiteboard session.
 *
 * Reconstructed from call sites across app.js and Room/room.js; the original
 * module was never committed to the repository (see issue #3).
 *
 * This module is deliberately dependency-free so it can be imported from
 * anywhere without creating an import cycle.
 */

/** The collaborative document: objects keyed by id, plus their z-order. */
function emptyDoc () {
  return { objects: {}, order: [], version: 0 }
}

export const state = {
  // ---- identity -----------------------------------------------------------
  localPeerId: null,
  peerName: '',
  peerNames: new Map(),   // peerId -> display name
  peerCount: 1,
  peerCursors: new Map(), // peerId -> { element, ... }

  // ---- networking ---------------------------------------------------------
  swarm: null,
  connections: new Set(),
  joined: false,
  roomKey: null,
  topicKey: null,
  outbox: [],
  flushing: false,

  // ---- document -----------------------------------------------------------
  doc: emptyDoc(),
  objects: null,   // legacy alias; the document lives in state.doc
  order: null,     // legacy alias; the order lives in state.doc.order
  undoStack: [],
  redoStack: [],
  savedAt: null,
  savedBy: null,
  thumbnail: null,

  // ---- canvas -------------------------------------------------------------
  ctx: null,
  DPR: (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
  dirty: true,
  showGrid: true,
  canvasType: 'dots',     // dots | lines | plain | storyboard

  // ---- view (pan and zoom) ------------------------------------------------
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  touchPanning: false,
  isSpacePressed: false,
  spaceHeld: false,
  lastCX: 0,
  lastCY: 0,
  lastTouchX: 0,
  lastTouchY: 0,
  lastTouchMid: null,

  // ---- tools and drawing --------------------------------------------------
  tool: 'pen',
  // Defaults chosen to match how boards are actually drawn here: a soft green
  // box with a black hand-drawn outline and rounded corners.
  strokeColor: '#1e1e1e',
  strokeSize: 2,          // medium — thin 1, medium 2, bold 4
  strokeOpacity: 1,
  strokeStyle: 'solid',   // solid | dashed | dotted
  backgroundColor: '#b2f2bb',
  fillStyle: 'solid',     // hachure | cross-hatch | solid
  edges: 'round',         // sharp | round
  fontFamily: 'hand',     // hand | normal | code
  fontSize: 20,           // S 16 | M 20 | L 28 | XL 36
  textAlign: 'center',    // left | center | right
  pressure: 'variable',   // variable | uniform
  sloppiness: 2,          // 0 architect, 1 artist, 2 cartoonist
  arrowType: 'straight',  // straight | curved | elbow
  snapAnchors: null,      // anchors shown while drawing an arrow
  pendingArrowId: null,   // arrow awaiting its second click
  pendingArrowStart: null,
  drawing: false,
  start: null,
  tempShape: null,
  eraserPath: null,
  textEl: null,
  labelEl: null,          // textarea while editing a shape's label
  editingLabelId: null,

  // ---- selection and dragging --------------------------------------------
  activeId: null,
  hoverId: null,
  selectedId: null,
  resizing: null,         // { id, handle, start, origin } while dragging a handle
  isDragging: false,
  dragStart: null,
  dragInitialPos: null,

  /**
   * Called after every document change. Set by the app at startup so that
   * auto-save can hook in without this module having to import it — keeping
   * AppState dependency-free and free of import cycles.
   */
  onChange: null,

  /** Mark the document as changed, so peers and snapshots see a new revision. */
  bumpDoc () {
    if (!this.doc) this.doc = emptyDoc()
    this.doc.version = (this.doc.version || 0) + 1
    this.dirty = true
    if (typeof this.onChange === 'function') {
      try {
        this.onChange()
      } catch (err) {
        console.error('state.onChange failed:', err)
      }
    }
  },

  /**
   * Ask for a repaint. The render loop in CanvasManager runs every frame and
   * returns early unless `dirty` is set, so requesting a render is just
   * raising that flag.
   */
  requestRender () {
    this.dirty = true
  },

  /** Short, collision-resistant id for a new object. */
  generateRandomId () {
    return (
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    )
  },

  /** Drop all document state, keeping identity and connection state. */
  resetDoc () {
    this.doc = emptyDoc()
    this.undoStack = []
    this.redoStack = []
    this.activeId = null
    this.hoverId = null
    this.dirty = true
  }
}

export default state
