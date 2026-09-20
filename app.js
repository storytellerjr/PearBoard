import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import loadIcons, { addAlphaToColor, getRandomColorPair } from "./helper.js";
import {Room, room} from "./Room/room.js";

import {globalState} from "./storage/GlobalState.js";
import { state } from './storage/AppState.js'
import { iconLibrary, importImageFile, BUILTIN_ID } from './storage/IconLibrary.js'
export const PEAR_PATH = Pear.config.storage

/**
 * Build stamp — shown in red, top-left, so it is always obvious which build
 * of the app a window is running. Updated on every code change.
 */
/**
 * True when the user is typing into a field.
 *
 * The app binds single-key shortcuts and swallows Space globally to stop the
 * page scrolling. Without this check those handlers also fire while someone is
 * typing, so a space could not be entered into any input on the board.
 */
/** The three font families offered, as CSS stacks. */
export const FONT_STACKS = {
  hand: "'Architects Daughter', 'Comic Sans MS', cursive",
  normal: "'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  code: "ui-monospace, SFMono-Regular, Menlo, 'Cascadia Mono', monospace"
}

/** A canvas font string for an object, falling back to sensible defaults. */
export function fontStringFor (obj) {
  const size = obj.fontSize || 20
  const stack = FONT_STACKS[obj.fontFamily] || FONT_STACKS.hand
  return `${size}px ${stack}`
}

export function isTypingTarget (target) {
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    target.isContentEditable === true
}

export const BUILD_STAMP = 'build 16:12:20'

document.addEventListener('DOMContentLoaded', () => {
  // Dev builds only: makes it obvious at a glance which build a window is
  // running, which matters when several windows are open during development.
  if (!Pear.config.dev) return
  const el = document.createElement('div')
  el.id = 'build-stamp'
  el.textContent = BUILD_STAMP
  document.body.appendChild(el)
}, { once: true })

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  WORLD_WIDTH: 50000,
  WORLD_HEIGHT: 50000,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 16,
  ZOOM_STEP: 1.1,
  GRID_TARGET_PX: 32,
  MIN_MINOR_PX: 8
};

// ============================================================================
// DOM UTILITIES
// ============================================================================

const $ = (selector) => document.querySelector(selector);

export const ui = {
  // Session elements
  mouse: $('#mouse-follower'),
  setup: $('#setup'),
  loading: $('#loading'),
  toolbar: $('header.toolbar'),
  boardWrap: $('.board-wrap'),
  canvas: $('#board'),
  overlayCanvas: $('#overlay'),

  // Rooms
  roomListContainer: $('#rooms-list-container'),
  roomsList: $('#rooms-list'),

  // Session controls
  createBtn: $('#create-canvas'),
  joinBtn: $('#join-canvas'),
  joinInput: $('#join-canvas-topic'),
  topicOut: $('#canvas-topic'),
  peersCount: $('#peers-count'),
  localPeerName: $('#local-peer-name'),

  // Button/Grp
  peerCountBtn: $('#peer-count-btn'),
  canvasRoomKey: $('.canvas-room-key'),
  loadStateBtn: $('.load-state-btn'),
  slideStateContainer: $('#slide-state-container'),
  slideStateBtn: $('.slide-state-btn'),
  slideStateCloseBtn: $('#slide-state-close-btn'),

  slideIconBtn: $('#slide-icon-btn'),
  slideIconContainer: $('#slide-icon-container'),
  slideIconCloseBtn: $('#slide-icon-close-btn'),

  // Tools
  tools: $('#tools'),
  color: $('#color'),
  size: $('#size'),
  undo: $('#undo'),
  redo: $('#redo'),
  clear: $('#clear'),
  save: $('#save'),
  saveState: $('#save-state'),
  peerNameBtn: $('#username-submit'),
  peerNameInput: $('#username-input'),
  namePopup: $('#name--input--popup'),

  // Canvas
  zoomMin: $('.zoom_min'),
  zoomMax: $('.zoom_max'),
  scaleDisplay: $('#zoom-scale-display'),
  opacitySlider: $('#opacity-control'),
};

// ============================================================================
// COORDINATE UTILITIES
// ============================================================================

class CoordinateUtils {
  static toCanvas(event) {
    const rect = ui.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    return {
      x: (clientX - state.panX) / state.zoom,
      y: (clientY - state.panY) / state.zoom
    };
  }

  static worldToScreen(worldX, worldY) {
    return {
      x: worldX * state.zoom + state.panX,
      y: worldY * state.zoom + state.panY
    };
  }

  static screenToWorld(screenX, screenY) {
    return {
      x: (screenX - state.panX) / state.zoom,
      y: (screenY - state.panY) / state.zoom
    };
  }
}

// ============================================================================
// CANVAS MANAGEMENT
// ============================================================================

export class CanvasManager {
  static init() {
    state.ctx = ui.canvas.getContext('2d', { alpha: true });
    this.resizeCanvas();
    this.setupEventListeners();
    this.startRenderLoop();
    this.renderFrame();

    // Add state for tracking touches and space key
    state.isDragging = false;
    state.isSpacePressed = false;
    state.lastTouchX = 0;
    state.lastTouchY = 0;
  }

  static setupEventListeners() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      if (typeof CursorManager !== 'undefined') {
        CursorManager.handleWindowResize();
      }
    });

    ui.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const zoomFactor = e.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
        const newZoom = Math.min(
            CONFIG.MAX_ZOOM,
            Math.max(CONFIG.MIN_ZOOM, state.zoom * zoomFactor)
        );

        if (newZoom === state.zoom) return;

        const rect = ui.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - state.panX) / state.zoom;
        const worldY = (mouseY - state.panY) / state.zoom;

        state.zoom = newZoom;

        state.panX = mouseX - (worldX * newZoom);
        state.panY = mouseY - (worldY * newZoom);

        const scalePercent = Math.round(newZoom * 100);
        ui.scaleDisplay.textContent = `${scalePercent}%`;

        this.clampPan();
        state.requestRender();

        if (typeof CursorManager !== 'undefined') {
          CursorManager.handleCanvasTransform();
        }
      } else {
        state.panX -= e.deltaX;
        state.panY -= e.deltaY;

        this.clampPan();
        state.requestRender();

        if (typeof CursorManager !== 'undefined') {
          CursorManager.handleCanvasTransform();
        }
      }
    }, { passive: false });


    // Add these variables at the class level (keep as-is)
    let lastPinchDistance = 0;
    let initialPinchDistance = 0;  // Add this
    let pinchStartZoom = 0;
    let pinchCenter = { x: 0, y: 0 };

// CORRECTED touchstart handler
    ui.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate initial pinch distance
        initialPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        lastPinchDistance = initialPinchDistance;

        // Store initial zoom level
        pinchStartZoom = state.zoom;

        // Calculate and STORE the initial pinch center point
        const rect = ui.canvas.getBoundingClientRect();
        pinchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };

        // Convert initial pinch center to world coordinates
        pinchCenter.worldX = (pinchCenter.x - rect.left - state.panX) / state.zoom;
        pinchCenter.worldY = (pinchCenter.y - rect.top - state.panY) / state.zoom;
      }
    });

// CORRECTED touchmove handler
    ui.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate current pinch distance
        const currentPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        // Calculate zoom based on initial distance (not last distance)
        const scale = currentPinchDistance / initialPinchDistance;
        const newZoom = Math.min(
            CONFIG.MAX_ZOOM,
            Math.max(CONFIG.MIN_ZOOM, pinchStartZoom * scale)
        );

        if (newZoom !== state.zoom) {
          // Get current pinch center
          const currentPinchCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
          };

          const rect = ui.canvas.getBoundingClientRect();

          // Apply new zoom
          state.zoom = newZoom;

          // Update pan to keep the world point under the pinch center fixed
          state.panX = currentPinchCenter.x - rect.left - (pinchCenter.worldX * newZoom);
          state.panY = currentPinchCenter.y - rect.top - (pinchCenter.worldY * newZoom);

          // Update zoom display
          ui.scaleDisplay.textContent = `${Math.round(newZoom * 100)}%`;

          // Update canvas and bounds
          CanvasManager.clampPan();
          state.requestRender();
          if (typeof CursorManager !== 'undefined') {
            CursorManager.handleCanvasTransform();
          }
        }
      }
    });

// touchend and touchcancel remain the same
    ui.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        lastPinchDistance = 0;
        initialPinchDistance = 0;  // Also reset this
        pinchStartZoom = 0;
      }
    });

    ui.canvas.addEventListener('touchcancel', () => {
      lastPinchDistance = 0;
      initialPinchDistance = 0;  // Also reset this
      pinchStartZoom = 0;
    });

    // Add space + mouse drag handlers
    document.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space' && !state.isSpacePressed) {
        state.isSpacePressed = true;
        ui.canvas.style.cursor = 'grab';
      }
    });

    document.addEventListener('keyup', (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        state.isSpacePressed = false;
        ui.canvas.style.cursor = 'default';
      }
    });

    ui.canvas.addEventListener('mousedown', (e) => {
      if (state.isSpacePressed) {
        e.preventDefault();
        state.isDragging = true;
        state.lastTouchX = e.clientX;
        state.lastTouchY = e.clientY;
        ui.canvas.style.cursor = 'grabbing';
      }
    });

    ui.canvas.addEventListener('mousemove', (e) => {
      if (state.isDragging && state.isSpacePressed) {
        e.preventDefault();
        const dx = e.clientX - state.lastTouchX;
        const dy = e.clientY - state.lastTouchY;

        state.panX += dx;
        state.panY += dy;

        state.lastTouchX = e.clientX;
        state.lastTouchY = e.clientY;

        this.clampPan();
        state.requestRender();
      }
    });

    ui.canvas.addEventListener('mouseup', () => {
      // Clear the flag whatever the space key is doing now. Guarding this on
      // isSpacePressed left isDragging stuck true whenever space was released
      // before the mouse button, and a stuck flag sends every later mousemove
      // down the dragging branch, so hover stopped working until the next
      // click happened to reset it.
      if (state.isDragging) {
        state.isDragging = false;
        InputHandler.updateCursor(state.hoverId);
      }
    });

    // Prevent space from scrolling the page — but never while typing.
    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
      }
    });

    // Existing zoom button listeners...
    ui.zoomMax.addEventListener('click', () => {
      this.handleZoomButton(CONFIG.ZOOM_STEP);
    });

    ui.zoomMin.addEventListener('click', () => {
      this.handleZoomButton(1 / CONFIG.ZOOM_STEP);
    });
  }

  static generateThumbnail(canvas, maxWidth = 300, maxHeight = 150) {
    const tmpCanvas = document.createElement('canvas')
    const ctx = tmpCanvas.getContext('2d')

    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
    tmpCanvas.width = canvas.width * ratio;
    tmpCanvas.height = canvas.height * ratio;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    ctx.scale(ratio, ratio);
    ctx.drawImage(canvas, 0, 0);

    return tmpCanvas.toDataURL('image/png');
  }

  static resizeCanvas() {
    const rect = ui.boardWrap.getBoundingClientRect();
    ui.canvas.width = Math.floor(rect.width * state.DPR);
    ui.canvas.height = Math.floor(rect.height * state.DPR);
    ui.canvas.style.width = `${rect.width}px`;
    ui.canvas.style.height = `${rect.height}px`;
    state.ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
    this.clampPan();
    state.requestRender();
  }


  static clampPan() {
    const viewWidthWorld = ui.canvas.clientWidth / state.zoom;
    const viewHeightWorld = ui.canvas.clientHeight / state.zoom;

    const leftWorld = -state.panX / state.zoom;
    const topWorld = -state.panY / state.zoom;

    const maxPanX = CONFIG.WORLD_WIDTH - viewWidthWorld;
    const maxPanY = CONFIG.WORLD_HEIGHT - viewHeightWorld;

    const clampedLeftWorld = Math.max(0, Math.min(leftWorld, maxPanX));
    const clampedTopWorld = Math.max(0, Math.min(topWorld, maxPanY));

    state.panX = -clampedLeftWorld * state.zoom;
    state.panY = -clampedTopWorld * state.zoom;
  }

  static centerView() {
    const viewWidth = ui.canvas.clientWidth;
    const viewHeight = ui.canvas.clientHeight;
    const startLeftWorld = (CONFIG.WORLD_WIDTH - viewWidth / state.zoom) / 2;
    const startTopWorld = (CONFIG.WORLD_HEIGHT - viewHeight / state.zoom) / 2;
    state.panX = -startLeftWorld * state.zoom;
    state.panY = -startTopWorld * state.zoom;
  }

  static handleZoomButton(zoomFactor) {
    const newZoom = Math.min(
        CONFIG.MAX_ZOOM,
        Math.max(CONFIG.MIN_ZOOM, state.zoom * zoomFactor)
    );

    if (newZoom === state.zoom) return;
    const rect = ui.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - state.panX) / state.zoom;
    const worldY = (centerY - state.panY) / state.zoom;

    state.zoom = newZoom;

    state.panX = centerX - (worldX * newZoom);
    state.panY = centerY - (worldY * newZoom);

    const scalePercent = Math.round(newZoom * 100);
    ui.scaleDisplay.textContent = `${scalePercent}%`;

    this.clampPan();
    state.requestRender();
    CursorManager.handleCanvasTransform();
  }


  static handleWheel(event) {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
    const newZoom = Math.min(
        CONFIG.MAX_ZOOM,
        Math.max(CONFIG.MIN_ZOOM, state.zoom * zoomFactor)
    );
    if (newZoom === state.zoom) return;
    const rect = ui.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (mouseX - state.panX) / state.zoom;
    const worldY = (mouseY - state.panY) / state.zoom;
    state.zoom = newZoom;
    state.panX = mouseX - (worldX * newZoom);
    state.panY = mouseY - (worldY * newZoom);
    const scalePercent = Math.round(newZoom * 100);
    ui.scaleDisplay.textContent = `${scalePercent}%`;
    this.clampPan();
    state.requestRender();
    CursorManager.handleCanvasTransform();
  }

  static startRenderLoop() {
    const render = () => {
      this.renderFrame();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  static renderFrame() {
    if (!state.dirty) return;
    state.dirty = false;

    if (state.tool === 'eraser' && state.eraserPath && state.eraserPath.length > 0) {
      // Render eraser preview
      state.ctx.save();
      state.ctx.globalCompositeOperation = 'source-over';
      state.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      state.ctx.lineWidth = state.strokeSize;
      state.ctx.lineCap = 'round';
      state.ctx.beginPath();
      state.ctx.moveTo(state.eraserPath[0].x, state.eraserPath[0].y);
      for (let i = 1; i < state.eraserPath.length; i++) {
        state.ctx.lineTo(state.eraserPath[i].x, state.eraserPath[i].y);
      }
      state.ctx.stroke();
      state.ctx.restore();
    }

    // Clear canvas
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

    // Set world transform
    const scale = state.DPR * state.zoom;
    const translateX = Math.round(state.DPR * state.panX);
    const translateY = Math.round(state.DPR * state.panY);
    state.ctx.setTransform(scale, 0, 0, scale, translateX, translateY);

    // Render grid
    if (state.showGrid) {
      GridRenderer.render(state.ctx, scale, translateX, translateY);
    }

    // Render objects
    ObjectRenderer.renderAll();

    // Render temporary shapes and hover states
    if (state.tempShape) {
      ObjectRenderer.renderTemp(state.tempShape);
    }

    if (state.hoverId && state.doc.objects[state.hoverId]) {
      ObjectRenderer.renderBounds(state.doc.objects[state.hoverId], 'rgba(37,99,235,.35)');
    }
  }
}

// ============================================================================
// GRID RENDERING
// ============================================================================


class GridRenderer {
  static render(ctx, scale, translateX, translateY) {
    const viewWidth = ui.canvas.clientWidth;
    const viewHeight = ui.canvas.clientHeight;

    // Calculate visible world area
    const leftWorld = -state.panX / state.zoom;
    const topWorld = -state.panY / state.zoom;
    const rightWorld = leftWorld + viewWidth / state.zoom;
    const bottomWorld = topWorld + viewHeight / state.zoom;

    // Calculate grid spacing
    const desiredWorld = CONFIG.GRID_TARGET_PX / state.zoom;
    const majorStep = this.calculateNiceStep(desiredWorld);
    const minorStep = majorStep / 5;

    // Check visibility thresholds
    const majorPixels = majorStep * state.zoom;
    const minorPixels = minorStep * state.zoom;
    const showMinor = minorPixels >= CONFIG.MIN_MINOR_PX;

    // Switch to screen space for crisp dots
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Render minor grid dots
    if (showMinor) {
      this.renderGridDots(ctx, minorStep, leftWorld, topWorld, rightWorld, bottomWorld,
          scale, translateX, translateY, 'rgba(0,0,0,0.15)', 1);
    }

    // Render major grid dots
    this.renderGridDots(ctx, majorStep, leftWorld, topWorld, rightWorld, bottomWorld,
        scale, translateX, translateY, 'rgba(0,0,0,0.45)', 3);

    ctx.restore();

    // Restore world transform
    ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
  }

  static renderGridDots(ctx, step, leftWorld, topWorld, rightWorld, bottomWorld,
                        scale, translateX, translateY, color, dotSize) {
    ctx.fillStyle = color;

    const startX = Math.floor(leftWorld / step) * step;
    const startY = Math.floor(topWorld / step) * step;

    for (let x = startX; x <= rightWorld; x += step) {
      for (let y = startY; y <= bottomWorld; y += step) {
        const screenX = Math.round(scale * x + translateX);
        const screenY = Math.round(scale * y + translateY);

        ctx.beginPath();
        ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  static calculateNiceStep(value) {
    if (value <= 0) return 1;
    const exponent = Math.floor(Math.log10(value));
    const base = Math.pow(10, exponent);
    const normalized = value / base;

    if (normalized <= 1) return 1 * base;
    if (normalized <= 2) return 2 * base;
    if (normalized <= 5) return 5 * base;
    return 10 * base;
  }
}
// ============================================================================
// OBJECT RENDERING
// ============================================================================

class ObjectRenderer {
  static renderAll() {
    for (const id of state.doc.order) {
      const obj = state.doc.objects[id];
      if (obj) {
        this.renderObject(obj);
      }
    }

    // Selection and hover outlines sit above everything else.
    if (state.tool === 'select' || state.tool === 'text') {
      const hovered = state.hoverId && state.hoverId !== state.selectedId
        ? state.doc.objects[state.hoverId]
        : null;
      if (hovered) this.renderBounds(hovered, 'rgba(37, 99, 235, .45)');

      const selected = state.tool === 'select' && state.selectedId
        ? state.doc.objects[state.selectedId]
        : null;
      if (selected) this.renderSelection(selected);
    }

    this.renderSnapAnchors();
  }

  static renderObject(obj) {
    if (obj.type === 'eraser') return;

    state.ctx.save();
    const strokeWidth = (obj.strokeWidth ?? 2) / state.zoom;
    state.ctx.lineWidth = obj.size;
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';

    if (obj.type === "eraser") {
      return;
    } else {
      state.ctx.globalCompositeOperation = "source-over";
      const alpha = typeof obj.opacity === 'number' ? obj.opacity : 1;
      state.ctx.strokeStyle = addAlphaToColor(obj.color, alpha);
      state.ctx.fillStyle = addAlphaToColor(obj.color, alpha);
    }

    this.applyStrokeStyle(obj.strokeStyle, obj.size);

    switch (obj.type) {
      case 'pen':
      case 'eraser':
        this.renderPath(obj);
        break;
      case 'line':
        this.renderLine(obj);
        break;
      case 'rect':
        this.renderRect(obj);
        this.renderLabel(obj);
        break;
      case 'ellipse':
        this.renderEllipse(obj);
        this.renderLabel(obj);
        break;
      case 'diamond':
        this.renderDiamond(obj);
        this.renderLabel(obj);
        break;
      case 'text':
        this.renderText(obj);
        break;
      case 'image':
        this.renderImage(obj);
        break;
      case 'arrow':
        this.renderArrow(obj);
        this.renderLabel(obj);
        break;
    }

    state.ctx.setLineDash([]);
    state.ctx.restore();
  }

  /**
   * Images from the icon library. Canvas drawing is synchronous but image
   * loading is not, so each source is cached; the first miss kicks off a load
   * and asks for a repaint once it arrives.
   */
  static renderImage(obj) {
    // Bundled icons carry a path; imported ones are referenced by library and
    // icon id, and their bytes are fetched from the local library store.
    const key = obj.src || (obj.libraryId && obj.iconId
      ? `${obj.libraryId}/${obj.iconId}`
      : null);
    if (!key) return;

    if (!CanvasManager._imageCache) CanvasManager._imageCache = new Map();
    const cache = CanvasManager._imageCache;

    let entry = cache.get(key);
    if (!entry) {
      const img = new Image();
      entry = { img, loaded: false };
      cache.set(key, entry);

      img.onload = () => {
        entry.loaded = true;
        state.requestRender();
      };
      img.onerror = () => {
        entry.failed = true;
        console.warn('Image failed to load:', key);
      };

      if (obj.src) {
        img.src = obj.src;
      } else {
        // Resolving from the library is asynchronous; the first frame misses
        // and a repaint is requested once the bytes arrive.
        iconLibrary.getIcon(obj.libraryId, obj.iconId)
          .then((icon) => {
            const source = icon && (icon.data || icon.src);
            if (source) {
              img.src = source;
            } else {
              entry.failed = true;
              console.warn('Icon not found in library:', key);
            }
          })
          .catch((err) => {
            entry.failed = true;
            console.error('Could not resolve icon', key, err);
          });
      }
    }

    if (!entry.loaded) return;

    const ctx = state.ctx;
    const w = obj.w || entry.img.width;
    const h = obj.h || entry.img.height;

    ctx.globalAlpha = typeof obj.opacity === 'number' ? obj.opacity : 1;

    const hasBackground = obj.backgroundColor && obj.backgroundColor !== 'transparent';

    if (hasBackground) {
      const pad = 10;
      const r = this.cornerRadius(obj, w + pad * 2, h + pad * 2);

      ctx.beginPath();
      if (r > 0 && typeof ctx.roundRect === 'function') {
        ctx.roundRect(obj.x - pad, obj.y - pad, w + pad * 2, h + pad * 2, r);
      } else {
        ctx.rect(obj.x - pad, obj.y - pad, w + pad * 2, h + pad * 2);
      }
      this.fillShape(obj);

      // Most icon art has an opaque white background, so a panel drawn behind
      // it would be painted straight over and only show as a border. Drawing
      // the image in 'multiply' lets white pass the colour through while the
      // dark lines stay dark — which is what changing an icon's background is
      // expected to do.
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(entry.img, obj.x, obj.y, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(entry.img, obj.x, obj.y, w, h);
    }

    // A frame round the image. The stroke colour never touches the artwork
    // itself — the colours inside an icon belong to whoever drew it.
    if (obj.strokeVisible !== false && (obj.size || 0) > 0) {
      const pad = 10;
      const frame = {
        ...obj,
        w: w + pad * 2,
        h: h + pad * 2
      };
      const r = this.cornerRadius(obj, frame.w, frame.h);

      ctx.save();
      ctx.lineWidth = obj.size || 2;
      ctx.strokeStyle = obj.color || '#1e1e1e';
      this.applyStrokeStyle(obj.strokeStyle, obj.size);

      const drawFrame = () => {
        if (r > 0 && typeof ctx.roundRect === 'function') {
          ctx.roundRect(obj.x - pad, obj.y - pad, frame.w, frame.h, r);
        } else {
          ctx.rect(obj.x - pad, obj.y - pad, frame.w, frame.h);
        }
      };

      if (this.sloppyAmount(obj) > 0) {
        this.strokeSloppy(frame, drawFrame, { skipFill: true });
      } else {
        ctx.beginPath();
        drawFrame();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    this.renderLabel(obj);
  }

  static renderPath(obj) {
    const points = obj.points || [];

    // A stroke drawn with pressure is thin where the pen lands and lifts, and
    // full width through the middle. Drawn segment by segment, because canvas
    // cannot vary lineWidth along a single path.
    if (obj.pressure === 'variable' && points.length > 2) {
      const ctx = state.ctx;
      const base = obj.size || 2;
      const n = points.length - 1;

      for (let i = 0; i < n; i++) {
        // Ramp up over the first fifth, down over the last.
        const t = i / n;
        const ramp = Math.min(1, t / 0.2, (1 - t) / 0.2);
        ctx.lineWidth = base * (0.35 + 0.65 * ramp);

        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
        ctx.stroke();
      }

      ctx.lineWidth = base;
      return;
    }

    if (points.length < 2) return;

    if (obj.type === 'eraser') {
      state.ctx.globalCompositeOperation = 'destination-out';
    } else {
      state.ctx.globalCompositeOperation = "source-over";
    }

    state.ctx.beginPath();
    state.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      state.ctx.lineTo(points[i].x, points[i].y);
    }
    state.ctx.stroke();

    if (obj.type === 'eraser') {
      state.ctx.globalCompositeOperation = 'source-over';
    }
  }

  static renderLine(obj) {
    state.ctx.beginPath();
    state.ctx.moveTo(obj.x, obj.y);
    state.ctx.lineTo(obj.x + (obj.w || 0), obj.y + (obj.h || 0));
    state.ctx.stroke();
  }

  /**
   * A hachure or cross-hatch pattern in the given colour.
   *
   * Built once per colour and style and cached — creating a pattern tile on
   * every frame would be wasteful, and the canvas redraws constantly.
   */
  static fillPattern(colour, style) {
    if (!CanvasManager._patterns) CanvasManager._patterns = new Map();
    const key = `${colour}|${style}`;

    const cached = CanvasManager._patterns.get(key);
    if (cached) return cached;

    const size = 10;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;

    const tc = tile.getContext('2d');
    tc.strokeStyle = colour;
    tc.lineWidth = 1.4;
    tc.lineCap = 'round';

    // Diagonal, drawn twice at the tile edges so the lines meet seamlessly.
    tc.beginPath();
    tc.moveTo(-2, size + 2);
    tc.lineTo(size + 2, -2);
    tc.moveTo(size - 2, size + 2);
    tc.lineTo(size + 2, size - 2);
    tc.moveTo(-2, 2);
    tc.lineTo(2, -2);
    tc.stroke();

    if (style === 'cross-hatch') {
      tc.beginPath();
      tc.moveTo(-2, -2);
      tc.lineTo(size + 2, size + 2);
      tc.moveTo(size - 2, -2);
      tc.lineTo(size + 2, 2);
      tc.moveTo(-2, size - 2);
      tc.lineTo(2, size + 2);
      tc.stroke();
    }

    const pattern = state.ctx.createPattern(tile, 'repeat');
    CanvasManager._patterns.set(key, pattern);
    return pattern;
  }

  /** Fill a shape's current path according to its background and fill style. */
  static fillShape(obj) {
    const bg = obj.backgroundColor;
    if (!bg || bg === 'transparent') return;

    const ctx = state.ctx;
    ctx.save();

    // Opacity is baked into the stroke colour elsewhere, but a background is
    // used as given — so it has to be applied here, or a shape with a fill
    // would ignore its own opacity entirely.
    const alpha = typeof obj.opacity === 'number' ? obj.opacity : 1;
    ctx.globalAlpha = ctx.globalAlpha * alpha;

    if (obj.fillStyle === 'hachure' || obj.fillStyle === 'cross-hatch') {
      ctx.fillStyle = this.fillPattern(bg, obj.fillStyle);
    } else {
      ctx.fillStyle = bg;
    }

    ctx.fill();
    ctx.restore();
  }

  /** Corner radius for a rounded rectangle, kept sane on small shapes. */
  static cornerRadius(obj, w, h) {
    if (obj.edges !== 'round') return 0;
    return Math.min(32, Math.abs(w) * 0.25, Math.abs(h) * 0.25);
  }

  static renderRect(obj) {
    const ctx = state.ctx;
    const w = obj.w || 0;
    const h = obj.h || 0;
    const r = this.cornerRadius(obj, w, h);

    const x = Math.min(obj.x, obj.x + w);
    const y = Math.min(obj.y, obj.y + h);
    const aw = Math.abs(w);
    const ah = Math.abs(h);

    const buildPath = () => {
      if (r > 0 && typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, aw, ah, r);
      } else {
        ctx.rect(obj.x, obj.y, w, h);
      }
    };

    // The fill always follows the true shape.
    ctx.beginPath();
    buildPath();
    this.fillShape(obj);

    if (this.sloppyAmount(obj) === 0) {
      ctx.stroke();
      return;
    }

    if (r > 0) {
      // Rounded: keep the real outline, gone over twice.
      this.strokeSloppy(obj, buildPath, { skipFill: true });
      return;
    }

    // Sharp: four separate edges, each overshooting its corners.
    this.strokeEdges(obj, [
      [x, y, x + aw, y],
      [x + aw, y, x + aw, y + ah],
      [x + aw, y + ah, x, y + ah],
      [x, y + ah, x, y]
    ]);
  }

  static renderEllipse(obj) {
    const ctx = state.ctx;
    const radiusX = Math.abs(obj.w || 0) / 2;
    const radiusY = Math.abs(obj.h || 0) / 2;
    const centerX = obj.x + (obj.w || 0) / 2;
    const centerY = obj.y + (obj.h || 0) / 2;

    this.strokeSloppy(obj, () => {
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    });
  }

  static renderDiamond(obj) {
    const ctx = state.ctx;
    const width = obj.w || 0;
    const height = obj.h || 0;
    const cx = obj.x + width / 2;
    const cy = obj.y + height / 2;

    const top = [cx, obj.y];
    const right = [obj.x + width, cy];
    const bottom = [cx, obj.y + height];
    const left = [obj.x, cy];

    const r = this.cornerRadius(obj, width, height) * 0.8;

    const buildPath = () => {
      if (r > 0) {
        // arcTo rounds each point where two sides meet.
        ctx.moveTo((top[0] + right[0]) / 2, (top[1] + right[1]) / 2);
        ctx.arcTo(right[0], right[1], bottom[0], bottom[1], r);
        ctx.arcTo(bottom[0], bottom[1], left[0], left[1], r);
        ctx.arcTo(left[0], left[1], top[0], top[1], r);
        ctx.arcTo(top[0], top[1], right[0], right[1], r);
        ctx.closePath();
      } else {
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(right[0], right[1]);
        ctx.lineTo(bottom[0], bottom[1]);
        ctx.lineTo(left[0], left[1]);
        ctx.closePath();
      }
    };

    ctx.beginPath();
    buildPath();
    this.fillShape(obj);

    if (this.sloppyAmount(obj) === 0) {
      ctx.stroke();
      return;
    }

    if (r > 0) {
      this.strokeSloppy(obj, buildPath, { skipFill: true });
      return;
    }

    this.strokeEdges(obj, [
      [...top, ...right],
      [...right, ...bottom],
      [...bottom, ...left],
      [...left, ...top]
    ]);
  }

  /**
   * A shape's label: text living inside the shape, wrapped to its width and
   * centred. Stored on the shape itself, so it moves and resizes with it and
   * needs no separate object to keep in step.
   */
  static renderLabel(obj) {
    if (state.editingLabelId === obj.id) return;

    const text = (obj.label || '').trim();
    if (!text) return;

    const ctx = state.ctx;
    const b = GeometryUtils.getBounds(obj);
    const size = obj.labelSize || 20;
    const family = FONT_STACKS[obj.labelFont || 'hand'] || FONT_STACKS.hand;

    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = typeof obj.opacity === 'number' ? obj.opacity : 1;
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = obj.labelColor || '#1e1e1e';
    ctx.textBaseline = 'middle';

    const align = obj.labelAlign || 'center';
    ctx.textAlign = align;

    // Diamonds taper, so their usable width is about half the box.
    const inset = obj.type === 'diamond' ? 0.5 : 0.85;
    const maxWidth = Math.max(20, b.w * inset);

    // An arrow has no body to sit in, so clear the line behind the words.
    const onArrow = obj.type === 'arrow';

    const lines = this.wrapText(text, maxWidth);
    const lineHeight = size * 1.25;

    // An image's text sits low inside its box rather than across the middle
    // of the artwork — a caption within the frame, not floating beneath it.
    // Multiple lines stack upward from the bottom. Everything else centres.
    const startY = obj.type === 'image'
      ? b.y + b.h - lineHeight * 0.75 - (lines.length - 1) * lineHeight
      : b.y + b.h / 2 - ((lines.length - 1) * lineHeight) / 2;

    // Where each line is anchored depends on the alignment; the inset keeps
    // left- and right-aligned text off the shape's own outline.
    const margin = (b.w - maxWidth) / 2;
    const centreX = align === 'left'
      ? b.x + margin
      : align === 'right'
        ? b.x + b.w - margin
        : b.x + b.w / 2;

    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;

      if (onArrow) {
        const w = ctx.measureText(line).width;
        const left = align === 'left'
          ? centreX
          : align === 'right'
            ? centreX - w
            : centreX - w / 2;

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(left - 4, y - lineHeight / 2, w + 8, lineHeight);
        ctx.restore();
      }

      ctx.fillText(line, centreX, y);
    });

    ctx.restore();
  }

  /** Break text into lines that fit, honouring newlines the user typed. */
  static wrapText(text, maxWidth) {
    const ctx = state.ctx;
    const lines = [];

    for (const paragraph of String(text).split('\n')) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) { lines.push(''); continue; }

      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const candidate = `${line} ${words[i]}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
          line = candidate;
        } else {
          lines.push(line);
          line = words[i];
        }
      }
      lines.push(line);
    }

    return lines;
  }

  static renderText(obj) {
    const ctx = state.ctx;
    ctx.setLineDash([]);
    ctx.fillStyle = obj.color;
    ctx.font = obj.fontFamily || obj.fontSize
      ? fontStringFor(obj)
      : (obj.font || '20px sans-serif');
    ctx.textAlign = obj.align || 'left';
    ctx.textBaseline = obj.baseline || 'top';

    // Text may hold newlines once it is edited in a textarea.
    const lines = String(obj.text || '').split('\n');
    const lineHeight = (obj.fontSize || 20) * 1.25;

    lines.forEach((line, i) => {
      ctx.fillText(line, obj.x, obj.y + i * lineHeight);
    });
  }

  /** Dash pattern for a stroke style, scaled so it reads at any zoom. */
  static applyStrokeStyle(style, size) {
    const ctx = state.ctx;
    // Scaled off a minimum so dashes stay visible on a thin stroke.
    const unit = Math.max(2.5, (size || 2) * 1.6);

    switch (style) {
      case 'dashed':
        ctx.setLineDash([unit * 3, unit * 2]);
        ctx.lineCap = 'butt';
        break;
      case 'dotted':
        ctx.setLineDash([0.1, unit * 2]);
        ctx.lineCap = 'round';
        break;
      default:
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
    }
  }

  /**
   * A small, repeatable offset for the hand-drawn look.
   *
   * Seeded from the object id and the point index, so a shape wobbles the same
   * way on every frame and on every peer's screen. Random jitter would shimmer
   * as the canvas redraws and would differ between peers.
   */
  static wobble(seed, index, amount) {
    if (!amount) return { x: 0, y: 0 };
    let h = 2166136261;
    const key = `${seed}:${index}`;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const a = ((h >>> 0) % 1000) / 1000 - 0.5;
    const b = ((Math.imul(h, 48271) >>> 0) % 1000) / 1000 - 0.5;
    return { x: a * amount * 2, y: b * amount * 2 };
  }

  static sloppyAmount(obj) {
    const level = obj.sloppiness ?? 0;
    return level === 0 ? 0 : level === 1 ? 1.2 : 2.4;
  }

  /**
   * One edge, drawn as a hand would: a slightly bowed line that runs a little
   * past each end.
   *
   * The overshoot is what makes hand-drawn corners read as hand-drawn — the
   * strokes cross slightly instead of meeting exactly. A single closed path
   * can never produce it, however much it is nudged.
   */
  static sloppyEdge(x1, y1, x2, y2, seed, amount) {
    const ctx = state.ctx;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // Run past both ends by a little, scaled to the line and the amount.
    const over = Math.min(len * 0.04, amount * 1.8);
    const o1 = this.wobble(seed, 1, amount * 0.5);
    const o2 = this.wobble(seed, 2, amount * 0.5);

    const sx = x1 - ux * over + o1.x;
    const sy = y1 - uy * over + o1.y;
    const ex = x2 + ux * over + o2.x;
    const ey = y2 + uy * over + o2.y;

    // Bow the middle perpendicular to the line.
    const bow = this.wobble(seed, 3, amount).x * 1.4;
    const mx = (sx + ex) / 2 - uy * bow;
    const my = (sy + ey) / 2 + ux * bow;

    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
  }

  /** Stroke a set of edges twice, as a pen gone over them would. */
  static strokeEdges(obj, edges) {
    const ctx = state.ctx;
    const amount = this.sloppyAmount(obj);
    const baseAlpha = ctx.globalAlpha;

    const baseWidth = ctx.lineWidth;

    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      edges.forEach(([x1, y1, x2, y2], i) => {
        this.sloppyEdge(x1, y1, x2, y2, `${obj.id}:${pass}:${i}`, amount);
      });
      ctx.lineWidth = pass === 0 ? baseWidth : baseWidth * 0.7;
      ctx.globalAlpha = baseAlpha * (pass === 0 ? 1 : 0.4);
      ctx.stroke();
    }

    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = baseWidth;
  }

  /**
   * Stroke a shape the way a hand would.
   *
   * The hand-drawn look is not jitter on the points — that reads as noise.
   * It is the same confident line gone over twice, each pass slightly
   * displaced and rotated. `buildPath` is called once per pass so the shape
   * stays exactly itself, only nudged.
   *
   * The displacement is seeded from the object id, so a shape looks identical
   * on every frame and on every peer's screen.
   */
  static strokeSloppy(obj, buildPath, { skipFill = false } = {}) {
    const ctx = state.ctx;
    const amount = this.sloppyAmount(obj);

    if (amount === 0) {
      ctx.beginPath();
      buildPath();
      if (!skipFill) this.fillShape(obj);
      ctx.stroke();
      return;
    }

    // First pass carries the fill; both passes carry the line.
    const passes = [
      { seed: 0, alpha: 1 },
      { seed: 1, alpha: 0.4 }
    ];

    const baseAlpha = ctx.globalAlpha;

    // Rotate about the shape's own centre. ctx.rotate() turns the canvas
    // around its origin, so rotating without recentring first swings a shape
    // that sits far from 0,0 right across the board — which drew the second
    // pass as a whole separate shape rather than a line gone over twice.
    const b = GeometryUtils.getBounds(obj);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    const baseWidth = ctx.lineWidth;

    passes.forEach((pass, index) => {
      const d = this.wobble(obj.id, pass.seed, amount);
      const tilt = this.wobble(obj.id, pass.seed + 10, amount).x * 0.0016;

      ctx.save();
      ctx.translate(cx + d.x, cy + d.y);
      ctx.rotate(tilt);
      ctx.translate(-cx, -cy);

      ctx.beginPath();
      buildPath();

      if (index === 0 && !skipFill) this.fillShape(obj);

      // The overlay pass is thinner and much fainter. Stroking twice at full
      // width and opacity doubles the apparent weight and reads as a hard,
      // heavy line rather than a hand-drawn one.
      ctx.lineWidth = index === 0 ? baseWidth : baseWidth * 0.7;
      ctx.globalAlpha = baseAlpha * pass.alpha;
      ctx.stroke();
      ctx.restore();
    });

    ctx.lineWidth = baseWidth;

    ctx.globalAlpha = baseAlpha;
  }

  static renderArrow(obj) {
    const ctx = state.ctx;
    const { start, end } = GeometryUtils.getArrowPoints(obj);
    const amount = this.sloppyAmount(obj);
    const type = obj.arrowType || 'straight';

    this.applyStrokeStyle(obj.strokeStyle, obj.size);

    const w1 = this.wobble(obj.id, 0, amount);
    const w2 = this.wobble(obj.id, 1, amount);
    const from = { x: start.x + w1.x, y: start.y + w1.y };
    const to = { x: end.x + w2.x, y: end.y + w2.y };

    // The tangent at the end decides which way the head points.
    let tangent;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);

    if (type === 'curved') {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      // Bow perpendicular to the line, by a fraction of its length.
      const bow = Math.min(len * 0.22, 90);
      const cx = mx - (dy / len) * bow;
      const cy = my + (dx / len) * bow;

      ctx.quadraticCurveTo(cx, cy, to.x, to.y);
      tangent = { x: to.x - cx, y: to.y - cy };
    } else if (type === 'elbow') {
      // Two axis-aligned segments meeting at a right angle, turning along
      // whichever axis has the greater distance first.
      const horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
      const corner = horizontalFirst
        ? { x: to.x, y: from.y }
        : { x: from.x, y: to.y };

      ctx.lineTo(corner.x, corner.y);
      ctx.lineTo(to.x, to.y);
      tangent = { x: to.x - corner.x, y: to.y - corner.y };
    } else {
      ctx.lineTo(to.x, to.y);
      tangent = { x: to.x - from.x, y: to.y - from.y };
    }

    ctx.stroke();

    this.renderArrowHead(to, tangent, obj);
    ctx.setLineDash([]);
  }

  static renderArrowHead(tip, tangent, obj) {
    const ctx = state.ctx;
    const angle = Math.atan2(tangent.y, tangent.x);
    const size = Math.max(11, (obj.size || 2) * 5);
    const spread = Math.PI / 7;

    // The head is solid, never dashed.
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
      tip.x - size * Math.cos(angle - spread),
      tip.y - size * Math.sin(angle - spread)
    );
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
      tip.x - size * Math.cos(angle + spread),
      tip.y - size * Math.sin(angle + spread)
    );
    ctx.stroke();
  }

  /** The anchors an arrow could snap to, shown while one is being drawn. */
  static renderSnapAnchors() {
    if (!state.snapAnchors) return;
    const ctx = state.ctx;

    ctx.save();
    ctx.setLineDash([]);
    for (const point of state.snapAnchors.points) {
      const active = state.snapAnchors.active &&
        state.snapAnchors.active.x === point.x &&
        state.snapAnchors.active.y === point.y;

      const r = (active ? 6 : 4.5) / state.zoom;

      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(37, 99, 235, .95)' : 'rgba(255, 255, 255, .95)';
      ctx.fill();

      ctx.lineWidth = 1.5 / state.zoom;
      ctx.strokeStyle = active ? 'rgba(37, 99, 235, 1)' : 'rgba(37, 99, 235, .65)';
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Half-size of a selection handle, in screen pixels. */
  static HANDLE = 4.5;

  /**
   * The eight points a shape can be resized from: its corners and the middle
   * of each side. Returned in world coordinates.
   */
  static handlePoints(obj) {
    const b = this.frameBounds(obj);
    const midX = b.x + b.w / 2;
    const midY = b.y + b.h / 2;

    return {
      nw: { x: b.x,         y: b.y },
      n:  { x: midX,        y: b.y },
      ne: { x: b.x + b.w,   y: b.y },
      e:  { x: b.x + b.w,   y: midY },
      se: { x: b.x + b.w,   y: b.y + b.h },
      s:  { x: midX,        y: b.y + b.h },
      sw: { x: b.x,         y: b.y + b.h },
      w:  { x: b.x,         y: midY }
    };
  }

  /** Which handle, if any, is under a point. Tolerance is in screen pixels. */
  static handleAt(obj, x, y) {
    if (!obj) return null;

    const reach = (this.HANDLE + 3) / state.zoom;
    const points = this.handlePoints(obj);

    for (const [name, p] of Object.entries(points)) {
      if (Math.abs(x - p.x) <= reach && Math.abs(y - p.y) <= reach) return name;
    }
    return null;
  }

  /** The resize cursor for each handle. */
  static handleCursor(name) {
    switch (name) {
      case 'nw': case 'se': return 'nwse-resize';
      case 'ne': case 'sw': return 'nesw-resize';
      case 'n':  case 's':  return 'ns-resize';
      case 'e':  case 'w':  return 'ew-resize';
      default: return 'default';
    }
  }

  /** The selected object's frame, with a square at each corner. */
  static renderSelection(obj) {
    const ctx = state.ctx;
    const b = this.frameBounds(obj);
    const pad = 4 / state.zoom;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 1 / state.zoom;
    ctx.strokeStyle = 'rgba(105, 101, 219, .9)';
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);

    // Corners only, as in the reference — the sides are draggable but bare.
    const size = this.HANDLE / state.zoom;
    const corners = ['nw', 'ne', 'se', 'sw'];
    const points = this.handlePoints(obj);

    ctx.fillStyle = '#ffffff';
    for (const name of corners) {
      const p = points[name];
      const x = p.x + (name.includes('w') ? -pad : pad);
      const y = p.y + (name.includes('n') ? -pad : pad);

      ctx.beginPath();
      ctx.rect(x - size, y - size, size * 2, size * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * A shape's frame for hover and selection.
   *
   * An arrow running straight across has a box a pixel or two tall, which
   * reads as a line rather than a frame, so thin objects are given a minimum
   * extent about their own centre.
   */
  static frameBounds(obj) {
    const b = GeometryUtils.getBounds(obj);
    const MIN = 28;

    let { x, y, w, h } = b;

    if (h < MIN) {
      y = b.y + b.h / 2 - MIN / 2;
      h = MIN;
    }
    if (w < MIN) {
      x = b.x + b.w / 2 - MIN / 2;
      w = MIN;
    }

    return { x, y, w, h };
  }

  static renderBounds(obj, color = 'rgba(0,0,0,.2)') {
    state.ctx.save();
    state.ctx.setLineDash([6, 6]);
    state.ctx.lineWidth = 1;
    state.ctx.strokeStyle = color;

    const bounds = this.frameBounds(obj);
    state.ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    state.ctx.restore();
  }

  static renderTemp(tempObj) {
    state.ctx.save();
    state.ctx.setLineDash([6 / state.zoom, 6 / state.zoom]);
    state.ctx.lineWidth = (tempObj.strokeWidth ?? 2) / state.zoom;
    this.renderObject(tempObj);
    state.ctx.restore();
  }
}

// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

class GeometryUtils {
  static getBounds(obj) {
    switch (obj.type) {
      case 'pen':
      case 'eraser':
        return this.getPathBounds(obj);
      case 'line':
        return this.getLineBounds(obj);
      case 'arrow': {
        const { start, end } = this.getArrowPoints(obj);
        return {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          w: Math.abs(end.x - start.x),
          h: Math.abs(end.y - start.y)
        };
      }
      case 'rect':
      case 'ellipse':
      case 'diamond':
        return this.getRectBounds(obj);
      case 'text':
        return this.getTextBounds(obj);
      default:
        return { x: obj.x, y: obj.y, w: Math.abs(obj.w || 0), h: Math.abs(obj.h || 0) };
    }
  }

  static getPathBounds(obj) {
    const points = obj.points || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      w: (maxX - minX) || 0,
      h: (maxY - minY) || 0
    };
  }

  static getLineBounds(obj) {
    return {
      x: Math.min(obj.x, obj.x + (obj.w || 0)),
      y: Math.min(obj.y, obj.y + (obj.h || 0)),
      w: Math.abs(obj.w || 0),
      h: Math.abs(obj.h || 0)
    };
  }

  /**
   * The four points an arrow can bind to: the midpoint of each side.
   * Taken from the object's bounds, so it works for boxes, diamonds,
   * ellipses and images alike.
   */
  static getAnchorPoints(obj) {
    const b = this.getBounds(obj);
    return {
      top:    { x: b.x + b.w / 2, y: b.y },
      right:  { x: b.x + b.w,     y: b.y + b.h / 2 },
      bottom: { x: b.x + b.w / 2, y: b.y + b.h },
      left:   { x: b.x,           y: b.y + b.h / 2 }
    };
  }

  /** Object types an arrow may bind to. */
  static isBindable(obj) {
    return obj && ['rect', 'ellipse', 'diamond', 'image'].includes(obj.type);
  }

  /**
   * The topmost bindable object at this point, allowing some slack around it
   * so an arrow binds when you are near a shape, not only exactly on it.
   */
  static findBindableAt(x, y, slack = 0, excludeId = null) {
    for (let i = state.doc.order.length - 1; i >= 0; i--) {
      const id = state.doc.order[i];
      if (id === excludeId) continue;

      const obj = state.doc.objects[id];
      if (!this.isBindable(obj)) continue;

      const b = this.getBounds(obj);
      if (x >= b.x - slack && x <= b.x + b.w + slack &&
          y >= b.y - slack && y <= b.y + b.h + slack) {
        return obj;
      }
    }
    return null;
  }

  /** Of an object's four anchors, the one nearest a point. */
  static nearestAnchorOf(obj, x, y) {
    const anchors = this.getAnchorPoints(obj);
    let best = null;
    let bestDist = Infinity;

    for (const [name, point] of Object.entries(anchors)) {
      const dist = Math.hypot(point.x - x, point.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { id: obj.id, anchor: name, point };
      }
    }
    return best;
  }

  /**
   * What an arrow endpoint at this point should bind to.
   *
   * Being anywhere over a shape is enough — the nearest of its four anchors
   * is chosen. Otherwise an anchor within `radius` still catches, so an arrow
   * can bind by pointing just outside a shape's edge.
   */
  static findBindingAt(x, y, radius, excludeId = null) {
    const over = this.findBindableAt(x, y, radius * 0.5, excludeId);
    if (over) return this.nearestAnchorOf(over, x, y);
    return this.findNearestAnchor(x, y, radius, excludeId);
  }

  /**
   * Nearest anchor on any bindable object within `radius` world units.
   * Returns { id, anchor, point } or null.
   */
  static findNearestAnchor(x, y, radius, excludeId = null) {
    let best = null;
    let bestDist = radius;

    for (const id of state.doc.order) {
      if (id === excludeId) continue;
      const obj = state.doc.objects[id];
      if (!this.isBindable(obj)) continue;

      const anchors = this.getAnchorPoints(obj);
      for (const [name, point] of Object.entries(anchors)) {
        const dist = Math.hypot(point.x - x, point.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          best = { id, anchor: name, point };
        }
      }
    }

    return best;
  }

  /**
   * An arrow's endpoints, following whatever it is bound to.
   * A binding whose target has gone is simply ignored.
   */
  static getArrowPoints(obj) {
    let start = { x: obj.x, y: obj.y };
    let end = { x: obj.x + (obj.w || 0), y: obj.y + (obj.h || 0) };

    if (obj.startBinding) {
      const target = state.doc.objects[obj.startBinding.id];
      if (target) {
        const anchors = this.getAnchorPoints(target);
        if (anchors[obj.startBinding.anchor]) start = anchors[obj.startBinding.anchor];
      }
    }

    if (obj.endBinding) {
      const target = state.doc.objects[obj.endBinding.id];
      if (target) {
        const anchors = this.getAnchorPoints(target);
        if (anchors[obj.endBinding.anchor]) end = anchors[obj.endBinding.anchor];
      }
    }

    return { start, end };
  }

  static getRectBounds(obj) {
    return {
      x: Math.min(obj.x, obj.x + (obj.w || 0)),
      y: Math.min(obj.y, obj.y + (obj.h || 0)),
      w: Math.abs(obj.w || 0),
      h: Math.abs(obj.h || 0)
    };
  }

  static getTextBounds(obj) {
    state.ctx.save();
    state.ctx.font = obj.font || '16px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
    const metrics = state.ctx.measureText(obj.text || '');
    const width = Math.max(10, metrics.width);
    const height = Math.max(16, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 20);
    state.ctx.restore();

    return { x: obj.x, y: obj.y, w: width, h: height };
  }

  static pointInBounds(obj, x, y) {
    const bounds = this.getBounds(obj);

    // An arrow's box can be only a pixel or two tall when it runs straight
    // across, which makes it almost impossible to click. Give thin objects
    // some slack.
    const padX = bounds.w < 16 ? 10 : 0;
    const padY = bounds.h < 16 ? 10 : 0;

    return x >= bounds.x - padX && y >= bounds.y - padY &&
        x <= bounds.x + bounds.w + padX && y <= bounds.y + bounds.h + padY;
  }
}

// ============================================================================
// DRAWING TOOLS
// ============================================================================

class DrawingTools {
  static selectTool(toolName) {
    state.tool = toolName;

    if (state.pendingArrowId) InputHandler.cancelArrow();
    state.snapAnchors = null;

    if (toolName !== 'select') {
      state.selectedId = null;
      state.hoverId = null;
    }
    InputHandler.updateCursor(null);
    UIManager.updateProperties({ open: true });
    state.requestRender();

    // Update UI
    [...ui.tools.querySelectorAll('.btn')].forEach(button => {
      button.classList.toggle('active', button.dataset.tool === toolName);
    });

    TextEditor.close(true);
  }

  static beginFreeDrawing(id, type, x, y) {
    if (type === 'eraser') {
      state.activeId = id;
      state.eraserPath = [{ x, y }];
      return;
    }

    const obj = {
      id,
      type,
      x,
      y,
      points: [{ x, y }],
      color: state.strokeColor,
      size: state.strokeSize,
      // Recorded on the stroke so it renders the same for everyone later.
      pressure: state.pressure || 'variable',
      opacity: state.strokeOpacity ?? 1,
      createdBy: state.localPeerId,
      rev: 0
    };

    DocumentManager.addObject(obj, true);
    state.activeId = id;
  }

  static addPoint(id, x, y) {
    if (state.tool === 'eraser') {
      state.eraserPath.push({ x, y });
      this.checkEraserIntersections({ x, y }); // Detect and delete intersected objects
      return;
    }

    const obj = state.doc.objects[id];
    if (!obj || !obj.points) return;

    obj.points.push({ x, y });
    obj.rev++;
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({ t: 'patch', id, path: 'points', push: { x, y } });
  }

  static checkEraserIntersections(currentPoint) {
    const eraserRadius = state.strokeSize;
    const objectsToDelete = [];

    for (const objId of state.doc.order) {
      const obj = state.doc.objects[objId];
      if (!obj || obj.type === 'eraser') continue;

      if (this.objectIntersectsPoint(obj, currentPoint, eraserRadius)) {
        objectsToDelete.push(objId);
      }
    }

    objectsToDelete.forEach(id => {
      DocumentManager.deleteObject(id, true);
    });
  }

  static objectIntersectsPoint(obj, point, radius) {
    switch (obj.type) {
      case 'pen':
        return this.pathIntersectsPoint(obj.points || [], point, radius);
      case 'line':
        return this.lineIntersectsPoint(obj, point, radius);
      case 'arrow': {
        const { start, end } = GeometryUtils.getArrowPoints(obj);
        return this.lineSegmentIntersectsCircle(start, end, point, radius);
      }
      case 'image':
        return this.shapeIntersectsPoint(obj, point, radius);
      case 'rect':
      case 'ellipse':
      case 'diamond':
        return this.shapeIntersectsPoint(obj, point, radius);
      case 'text':
        return this.textIntersectsPoint(obj, point, radius);
      default:
        return false;
    }
  }

  static pathIntersectsPoint(points, point, radius) {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (this.lineSegmentIntersectsCircle(p1, p2, point, radius)) {
        return true;
      }
    }
    return false;
  }

  static lineIntersectsPoint(obj, point, radius) {
    const start = { x: obj.x, y: obj.y };
    const end = { x: obj.x + (obj.w || 0), y: obj.y + (obj.h || 0) };
    return this.lineSegmentIntersectsCircle(start, end, point, radius);
  }

  static shapeIntersectsPoint(obj, point, radius) {
    const bounds = GeometryUtils.getBounds(obj);
    // Expand bounds by eraser radius
    return point.x >= bounds.x - radius &&
        point.x <= bounds.x + bounds.w + radius &&
        point.y >= bounds.y - radius &&
        point.y <= bounds.y + bounds.h + radius;
  }

  static textIntersectsPoint(obj, point, radius) {
    const bounds = GeometryUtils.getBounds(obj);
    // Expand bounds by eraser radius
    return point.x >= bounds.x - radius &&
        point.x <= bounds.x + bounds.w + radius &&
        point.y >= bounds.y - radius &&
        point.y <= bounds.y + bounds.h + radius;
  }

  static lineSegmentIntersectsCircle(p1, p2, center, radius) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      // Point to point distance
      const dist = Math.sqrt((p1.x - center.x) ** 2 + (p1.y - center.y) ** 2);
      return dist <= radius;
    }

    const unitX = dx / length;
    const unitY = dy / length;
    const toPointX = center.x - p1.x;
    const toPointY = center.y - p1.y;
    const dot = toPointX * unitX + toPointY * unitY;

    const closestPoint = {
      x: p1.x + Math.max(0, Math.min(length, dot)) * unitX,
      y: p1.y + Math.max(0, Math.min(length, dot)) * unitY
    };

    const distance = Math.sqrt(
        (center.x - closestPoint.x) ** 2 + (center.y - closestPoint.y) ** 2
    );

    return distance <= radius;
  }

  static finishStroke(id) {
    if (!id) return;

    state.snapAnchors = null;

    if (state.tool === 'eraser') {
      state.eraserPath = null;
      return;
    }

    NetworkManager.queueOperation({ t: 'touch', id });
  }

  /** How close, in world units, an arrow endpoint must be to snap. */
  static SNAP_RADIUS = 26;

  static beginShape(id, type, x, y) {
    let startBinding = null;
    let sx = x;
    let sy = y;

    if (type === 'arrow') {
      const hit = GeometryUtils.findBindingAt(x, y, this.SNAP_RADIUS);
      if (hit) {
        startBinding = { id: hit.id, anchor: hit.anchor };
        sx = hit.point.x;
        sy = hit.point.y;
      }
    }

    const obj = {
      id,
      type,
      x: sx,
      y: sy,
      w: 0,
      h: 0,
      color: state.strokeColor,
      size: state.strokeSize,
      opacity: state.strokeOpacity ?? 1,
      strokeStyle: state.strokeStyle || 'solid',
      sloppiness: state.sloppiness ?? 0,
      backgroundColor: state.backgroundColor || 'transparent',
      fillStyle: state.fillStyle || 'solid',
      edges: state.edges || 'sharp',
      createdBy: state.localPeerId,
      rev: 0
    };

    if (type === 'arrow') {
      obj.arrowType = state.arrowType || 'straight';
      obj.startBinding = startBinding;
      obj.endBinding = null;
    }

    DocumentManager.addObject(obj, true);
    state.activeId = id;
  }

  static resizeShape(id, x, y) {
    const obj = state.doc.objects[id];
    if (!obj) return;

    let tx = x;
    let ty = y;

    if (obj.type === 'arrow') {
      // Offer the anchors of whatever is under the pointer, and snap to the
      // nearest one. Binding by id, not position, so the arrow follows later.
      const hit = GeometryUtils.findBindingAt(x, y, this.SNAP_RADIUS, id);
      if (hit) {
        obj.endBinding = { id: hit.id, anchor: hit.anchor };
        tx = hit.point.x;
        ty = hit.point.y;

      } else {
        obj.endBinding = null;
      }
    }

    obj.w = tx - obj.x;
    obj.h = ty - obj.y;
    obj.rev++;
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({
      t: 'update',
      id,
      patch: { w: obj.w, h: obj.h, rev: obj.rev }
    });
  }
}

// ============================================================================
// TEXT EDITOR
// ============================================================================

/**
 * Editing the label inside a shape.
 *
 * A textarea is laid over the shape while typing, using the same font and
 * size as the canvas, so what is typed looks like what will be drawn.
 */
class LabelEditor {
  static open(obj) {
    this.close();

    const b = GeometryUtils.getBounds(obj);
    const rect = ui.canvas.getBoundingClientRect();
    const size = obj.labelSize || 20;
    const lineHeight = size * state.zoom * 1.25;

    // Place the editor centred on the shape rather than at its top-left. An
    // arrow's box is a pixel or two tall when it runs straight across, so
    // anchoring to the top put the words above the line instead of on it.
    // The editor opens where the caption will be drawn: low inside the box.
    const anchorY = obj.type === 'image'
      ? b.y + b.h - (obj.labelSize || 20) * 0.9
      : b.y + b.h / 2;
    const centre = CoordinateUtils.worldToScreen(b.x + b.w / 2, anchorY);
    const boxWidth = Math.max(b.w * state.zoom, 120);
    const boxHeight = Math.max(b.h * state.zoom, lineHeight * 1.6);

    const area = document.createElement('textarea');
    area.className = 'label-editor';
    area.dataset.id = obj.id;
    area.value = obj.label || '';
    area.spellcheck = false;

    Object.assign(area.style, {
      position: 'absolute',
      left: `${rect.left + centre.x - boxWidth / 2}px`,
      top: `${rect.top + centre.y - boxHeight / 2}px`,
      width: `${boxWidth}px`,
      height: `${boxHeight}px`,
      fontFamily: FONT_STACKS[obj.labelFont || 'hand'] || FONT_STACKS.hand,
      fontSize: `${size * state.zoom}px`,
      lineHeight: '1.25',
      color: obj.labelColor || '#1e1e1e',
      textAlign: obj.labelAlign || 'center',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      padding: '0 8px',
      caretColor: obj.labelColor || '#1e1e1e',
      zIndex: '9999'
    });

    // A textarea cannot centre its content vertically, so the top padding is
    // computed from how many lines there are and kept in step as you type.
    const centreVertically = () => {
      const lines = Math.max(1, area.value.split('\n').length);
      const pad = Math.max(0, (boxHeight - lines * lineHeight) / 2);
      area.style.paddingTop = `${pad}px`;
    };

    centreVertically();
    area.addEventListener('input', centreVertically);

    area.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.commit();
      }
    });

    area.addEventListener('blur', () => this.commit());

    document.body.appendChild(area);
    state.labelEl = area;

    // Hide the drawn label while editing, so it is not doubled.
    state.editingLabelId = obj.id;
    state.requestRender();

    setTimeout(() => {
      area.focus();
      area.select();
    }, 0);
  }

  static commit() {
    const area = state.labelEl;
    if (!area) return;

    state.labelEl = null;
    const id = area.dataset.id;
    const text = area.value;
    area.remove();

    state.editingLabelId = null;

    const obj = state.doc.objects[id];
    if (obj) {
      DocumentManager.updateObject(id, {
        label: text,
        labelFont: obj.labelFont || state.fontFamily || 'hand',
        labelSize: obj.labelSize || state.fontSize || 20,
        labelColor: obj.labelColor || state.strokeColor
      }, true);
    }

    state.requestRender();
  }

  static close() {
    if (!state.labelEl) return;
    state.labelEl.remove();
    state.labelEl = null;
    state.editingLabelId = null;
  }
}

class TextEditor {
  static open(worldX, worldY, initialText = '') {
    this.close(true);

    const id = state.generateRandomId();
    const fontPixels = state.fontSize || 20;

    // Create text object
    const textObj = {
      id,
      type: 'text',
      x: worldX,
      y: worldY,
      text: initialText,
      color: state.strokeColor,
      size: state.strokeSize,
      fontFamily: state.fontFamily || 'hand',
      fontSize: fontPixels,
      font: `${fontPixels}px ${FONT_STACKS[state.fontFamily] || FONT_STACKS.hand}`,
      align: state.textAlign || 'center',
      baseline: 'top',
      createdBy: state.localPeerId,
      rev: 0
    };

    DocumentManager.addObject(textObj, true);
    state.activeId = id;

    // Create editor element
    const screenPos = CoordinateUtils.worldToScreen(worldX, worldY);
    const canvasRect = ui.canvas.getBoundingClientRect();

    const editorDiv = this.createEditorElement(
        screenPos.x + canvasRect.left,
        screenPos.y + canvasRect.top,
        textObj,
        fontPixels,
        initialText
    );

    document.body.appendChild(editorDiv);
    state.textEl = editorDiv;

    // Focus and position cursor
    setTimeout(() => {
      editorDiv.focus();
      if (initialText) {
        this.placeCaretAtEnd(editorDiv);
      }
    }, 0);
  }

  static createEditorElement(x, y, textObj, fontPixels, initialText) {
    const div = document.createElement('textarea');
    div.className = 'text-editor';
    div.dataset.id = textObj.id;
    div.spellcheck = false;

    Object.assign(div.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      font: '',
      fontFamily: FONT_STACKS[textObj.fontFamily] || FONT_STACKS.hand,
      fontSize: `${fontPixels}px`,
      textAlign: textObj.align || 'left',
      color: textObj.color,
      // No chrome: typing should look like writing straight onto the board.
      border: 'none',
      background: 'transparent',
      padding: '0',
      margin: '0',
      outline: 'none',
      boxShadow: 'none',
      caretColor: textObj.color,
      lineHeight: '1.25',
      resize: 'none',
      zIndex: '9999',
      whiteSpace: 'pre-wrap',
      overflow: 'visible',
      minWidth: '20px',
      minHeight: '16px',
      maxWidth: '400px',
      transformOrigin: 'top left',
      transform: state.zoom !== 1 ? `scale(${state.zoom})` : 'none'
    });

    if (initialText) {
      div.value = initialText;
    }

    this.attachEditorEventListeners(div);
    return div;
  }

  static attachEditorEventListeners(div) {
    div.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close(false);
      }
    });

    div.addEventListener('blur', () => {
      setTimeout(() => this.commit(), 100);
    });

    // Prevent canvas events
    ['mousedown', 'mousemove', 'mouseup'].forEach(eventType => {
      div.addEventListener(eventType, (e) => e.stopPropagation());
    });
  }

  static commit() {
    // Capture and clear the editor element from state immediately
    const editorDiv = state.textEl;
    state.textEl = null;
    state.activeId = null;

    // If there's no active editor, nothing to do
    if (!editorDiv) return;

    const id = editorDiv.dataset.id;
    const obj = state.doc.objects[id];
    if (!obj) {
      // No backing object? Just remove the editor
      editorDiv.remove();
      return;
    }

    // The editor is a <textarea>, so typed input lands in .value while
    // .textContent stays empty. The original read only .textContent, so every
    // commit looked blank and deleted the object the user had just typed into.
    // Prefer whichever field actually holds text, so this survives either.
    const fromValue = typeof editorDiv.value === 'string' ? editorDiv.value : '';
    const fromText = editorDiv.textContent || '';
    const raw = fromValue.trim() !== '' ? fromValue : fromText;
    const text = raw.trim();


    if (text === '') {
      // Delete empty text object
      DocumentManager.deleteObject(id, true);
    } else {
      // Update the text object
      DocumentManager.updateObject(id, { text }, true);
    }

    // Remove editor from DOM
    editorDiv.remove();
  }



  static close(shouldCommit = false) {
    if (!state.textEl) return;

    const element = state.textEl;
    const id = element.dataset.id;
    state.textEl = null;
    state.activeId = null;

    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }

    // Clean up empty object if not committing
    if (!shouldCommit && id && state.doc.objects[id] && !state.doc.objects[id].text) {
      DocumentManager.deleteObject(id, false);
    }
  }

  static placeCaretAtEnd(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

class DocumentManager {
  static addObject(obj, isLocal = false) {
    if (state.doc.objects[obj.id]) return; // Idempotent

    state.doc.objects[obj.id] = obj;
    state.doc.order.push(obj.id);
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'del', id: obj.id, before: obj });
      NetworkManager.queueOperation({ t: 'add', obj });
    }
  }

  static updateObject(id, patch, isLocal = false) {
    const obj = state.doc.objects[id];
    if (!obj) return;

    const before = { ...obj };
    Object.assign(obj, patch);
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'update', id, before, after: { ...obj } });
      NetworkManager.queueOperation({ t: 'update', id, patch });
    }
  }

  /**
   * Move an object through the z-order. `order` is back-to-front, so the end
   * of the array is what the user sees on top.
   */
  static reorderObject(id, where) {
    const order = state.doc.order;
    const from = order.indexOf(id);
    if (from === -1) return;

    order.splice(from, 1);

    let to;
    switch (where) {
      case 'back':     to = 0; break;
      case 'backward': to = Math.max(0, from - 1); break;
      case 'forward':  to = Math.min(order.length, from + 1); break;
      default:         to = order.length;
    }

    order.splice(to, 0, id);
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({ t: 'reorder', id, where });
  }

  static deleteObject(id, isLocal = false) {
    const obj = state.doc.objects[id];
    if (!obj) return;

    delete state.doc.objects[id];
    state.doc.order = state.doc.order.filter(objId => objId !== id);
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'add', obj });
      NetworkManager.queueOperation({ t: 'delete', id });
    }
  }

  static clearAll(isLocal = false) {
    const snapshot = JSON.stringify(state.doc);
    state.doc.objects = {};
    state.doc.order = [];
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'restore', snapshot });
      NetworkManager.queueOperation({ t: 'clear' });
    }
  }

  static findTopObjectAt(x, y) {
    for (let i = state.doc.order.length - 1; i >= 0; i--) {
      const id = state.doc.order[i];
      const obj = state.doc.objects[id];
      if (obj && GeometryUtils.pointInBounds(obj, x, y)) {
        return id;
      }
    }
    return null;
  }
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

class HistoryManager {
  static pushUndo(entry) {
    state.undoStack.push(entry);
    state.redoStack.length = 0; // Clear redo stack
  }

  static undo() {
    const entry = state.undoStack.pop();
    if (!entry) return;

    switch (entry.t) {
      case 'del':
        const obj = state.doc.objects[entry.id];
        if (obj) {
          DocumentManager.deleteObject(entry.id, false);
          NetworkManager.queueOperation({ t: 'delete', id: entry.id });
          state.redoStack.push({ t: 'add', obj: entry.before });
        }
        break;
      case 'add':
        DocumentManager.addObject(entry.obj, false);
        NetworkManager.queueOperation({ t: 'add', obj: entry.obj });
        state.redoStack.push({ t: 'del', id: entry.obj.id, before: entry.obj });
        break;
      case 'update':
        state.doc.objects[entry.id] = entry.before;
        state.bumpDoc();
        state.requestRender();
        NetworkManager.queueOperation({ t: 'update', id: entry.id, patch: entry.before });
        state.redoStack.push({ t: 'update', id: entry.id, before: entry.after, after: entry.before });
        break;
      case 'restore':
        const currentSnapshot = JSON.stringify(state.doc);
        Object.assign(state.doc, JSON.parse(entry.snapshot));
        state.bumpDoc();
        state.requestRender();
        NetworkManager.queueOperation({ t: 'full', snapshot: entry.snapshot });
        state.redoStack.push({ t: 'restore', snapshot: currentSnapshot });
        break;
    }
  }

  static redo() {
    const entry = state.redoStack.pop();
    if (!entry) return;

    switch (entry.t) {
      case 'add':
        DocumentManager.addObject(entry.obj, true);
        break;
      case 'update':
        DocumentManager.updateObject(entry.id, entry.after, true);
        break;
      case 'restore':
        const currentSnapshot = JSON.stringify(state.doc);
        Object.assign(state.doc, JSON.parse(entry.snapshot));
        state.bumpDoc();
        state.requestRender();
        NetworkManager.queueOperation({ t: 'full', snapshot: entry.snapshot });
        state.undoStack.push({ t: 'restore', snapshot: currentSnapshot });
        break;
    }
  }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

class InputHandler {
  static init() {
    this.setupKeyboardHandlers();
    this.setupMouseHandlers();
    this.setupTouchHandlers();
    this.setupPanningHandlers();
  }

  static setupKeyboardHandlers() {
    window.addEventListener('keydown', (e) => {
      // Single-key tool shortcuts must not fire while typing.
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === 'z') {
        e.preventDefault();
        HistoryManager.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'z') {
        e.preventDefault();
        HistoryManager.redo();
      }

      // Tool shortcuts
      else if (!e.ctrlKey && !e.metaKey) {
        switch (key) {
          case 'v': DrawingTools.selectTool('select'); break;
          case 'a': DrawingTools.selectTool('arrow'); break;
          case 'p': DrawingTools.selectTool('pen'); break;
          case 'e': DrawingTools.selectTool('eraser'); break;
          case 'l': DrawingTools.selectTool('line'); break;
          case 'r': DrawingTools.selectTool('rect'); break;
          case 'o': DrawingTools.selectTool('ellipse'); break;
          case 'd': DrawingTools.selectTool('diamond'); break;
          case 't': DrawingTools.selectTool('text'); break;
        }

        // Abandon an arrow that is waiting for its second click.
        if (e.key === 'Escape' && state.pendingArrowId) {
          e.preventDefault();
          InputHandler.cancelArrow();
        }

        // Remove the selected object.
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
          e.preventDefault();
          DocumentManager.deleteObject(state.selectedId, true);
          state.selectedId = null;
          state.hoverId = null;
          UIManager.updateProperties();
          state.requestRender();
        }
      }

      // Panning
      if (e.code === 'Space') {
        state.spaceHeld = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        state.spaceHeld = false;
      }
    });
  }

  static setupMouseHandlers() {
    ui.canvas.addEventListener('dblclick', (e) => {
      const coords = CoordinateUtils.toCanvas(e);
      const id = DocumentManager.findTopObjectAt(coords.x, coords.y);
      if (!id) return;

      const obj = state.doc.objects[id];
      if (!obj || !['rect', 'ellipse', 'diamond', 'arrow', 'image'].includes(obj.type)) return;

      e.preventDefault();
      state.selectedId = id;
      LabelEditor.open(obj);
    });

    ui.canvas.addEventListener('mouseleave', () => {
      if (state.hoverId !== null) {
        state.hoverId = null;
        state.requestRender();
      }
      ui.canvas.style.cursor = 'default';
    });

    ui.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    ui.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    ui.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    ui.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    ui.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  static setupTouchHandlers() {
    ui.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    ui.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    ui.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  static setupPanningHandlers() {
    window.addEventListener('mousemove', (e) => this.handlePanMove(e));
    window.addEventListener('mouseup', () => this.handlePanEnd());
  }

  static handleMouseDown(event) {
    const coords = CoordinateUtils.toCanvas(event);

    // Check for panning
    if (this.shouldStartPanning(event)) {
      this.startPanning(event);
      return;
    }

    // Arrows are placed click, move, click — you point at where it starts,
    // watch the line follow the pointer, then point at where the head goes.
    // Dragging also works, for anyone who expects that instead.
    if (state.tool === 'arrow') {
      if (state.pendingArrowId) {
        this.finishArrow(coords);
      } else {
        const id = state.generateRandomId();
        DrawingTools.beginShape(id, 'arrow', coords.x, coords.y);
        state.pendingArrowId = id;
        state.pendingArrowStart = coords;
        state.drawing = false;
      }
      return;
    }

    // The select tool picks an object up directly. Shift does the same with
    // any tool, which is how this worked before there was a select tool.
    if (state.tool === 'select' || event.shiftKey) {
      // A handle on the current selection takes priority over anything under
      // it, so a corner stays grabbable when shapes overlap.
      const selected = state.selectedId ? state.doc.objects[state.selectedId] : null;
      const handle = ObjectRenderer.handleAt(selected, coords.x, coords.y);
      if (handle) {
        this.startResizing(selected, handle, coords);
        return;
      }

      const objectId = DocumentManager.findTopObjectAt(coords.x, coords.y);
      if (objectId) {
        state.selectedId = objectId;
        this.startDragging(objectId, coords);
        UIManager.updateProperties({ open: true });
        state.requestRender();
        return;
      }

      if (state.tool === 'select') {
        // Clicking empty space clears the selection.
        state.selectedId = null;
        UIManager.updateProperties();
        state.requestRender();
        return;
      }
    }

    // Start drawing
    this.startDrawing(coords);
  }

  /** Settle the arrow at `coords`, or discard it if it has no length. */
  static finishArrow(coords) {
    const id = state.pendingArrowId;
    if (!id) return;

    DrawingTools.resizeShape(id, coords.x, coords.y);

    const obj = state.doc.objects[id];
    if (obj && Math.hypot(obj.w || 0, obj.h || 0) < 4 && !obj.endBinding) {
      // A stray click with nowhere to point: drop it rather than leave a
      // zero-length arrow, which renders as a lone arrowhead.
      DocumentManager.deleteObject(id, true);
    }

    state.pendingArrowId = null;
    state.pendingArrowStart = null;
    state.snapAnchors = null;
    state.activeId = null;
    state.requestRender();
  }

  /** Abandon an arrow in progress. */
  static cancelArrow() {
    const id = state.pendingArrowId;
    if (!id) return;

    DocumentManager.deleteObject(id, true);
    state.pendingArrowId = null;
    state.pendingArrowStart = null;
    state.snapAnchors = null;
    state.activeId = null;
    state.requestRender();
  }

  /**
   * The pointer tells you what will happen if you press.
   *
   * Drawing tools show a crosshair, the select tool shows the four-way move
   * cross when something is under the pointer, and a plain arrow over empty
   * board. Set in one place so the tools cannot disagree.
   */
  static updateCursor(hoveredId, isShiftPressed = false) {
    let cursor = 'default';

    switch (state.tool) {
      case 'select':
        cursor = hoveredId ? 'move' : 'default';
        break;
      case 'hand':
        cursor = state.isPanning ? 'grabbing' : 'grab';
        break;
      case 'eraser':
        cursor = 'cell';
        break;
      case 'text':
        cursor = 'text';
        break;
      case 'pen':
      case 'line':
      case 'arrow':
      case 'rect':
      case 'ellipse':
      case 'diamond':
        cursor = 'crosshair';
        break;
    }

    // Shift picks an object up with any tool, so show that it would.
    if (isShiftPressed && hoveredId) cursor = 'move';
    if (state.isSpacePressed || state.spaceHeld) cursor = 'grab';
    if (ui.canvas.style.cursor !== cursor) ui.canvas.style.cursor = cursor;
  }

  static handleMouseMove(event) {
    const coords = CoordinateUtils.toCanvas(event);

    // With the arrow tool active, show the anchors of whatever shape is under
    // the pointer, so it is clear where the arrow will attach before clicking.
    if (state.tool === 'arrow') {
      const hit = GeometryUtils.findBindingAt(
        coords.x,
        coords.y,
        DrawingTools.SNAP_RADIUS,
        state.pendingArrowId
      );

      if (hit) {
        const target = state.doc.objects[hit.id];
        state.snapAnchors = {
          points: Object.values(GeometryUtils.getAnchorPoints(target)),
          active: hit.point
        };
      } else {
        state.snapAnchors = null;
      }
      state.requestRender();
    }

    // An arrow in progress follows the pointer until the second click.
    if (state.pendingArrowId) {
      DrawingTools.resizeShape(state.pendingArrowId, coords.x, coords.y);
      return;
    }

    if (state.resizing) {
      this.continueResizing(coords);
      return;
    }

    if (state.drawing && state.activeId) {
      this.continuDrawing(coords);
    } else if (state.isDragging && state.activeId) {
      this.continueDragging(coords);
    } else {
      this.updateHover(coords, event.shiftKey);
    }
  }

  static handleMouseUp(event) {
    if (state.resizing) {
      this.endResizing();
      return;
    }

    // Released after dragging a decent distance? Treat it as a drawn arrow.
    // A click barely moves, and leaves the arrow waiting for its second click.
    if (state.pendingArrowId) {
      const coords = CoordinateUtils.toCanvas(event);
      const start = state.pendingArrowStart;
      const moved = start
        ? Math.hypot(coords.x - start.x, coords.y - start.y)
        : 0;

      if (moved > 8) this.finishArrow(coords);
      return;
    }

    if (state.isDragging) {
      state.isDragging = false;
      state.activeId = null;
      state.dragStart = null;
      state.dragInitialPos = null;
      return;
    }

    if (!state.drawing) return;

    state.drawing = false;
    if (['pen', 'eraser'].includes(state.tool)) {
      DrawingTools.finishStroke(state.activeId);
    }

    state.activeId = null;
  }

  static handleDoubleClick(event) {
    const coords = CoordinateUtils.toCanvas(event);
    const objectId = DocumentManager.findTopObjectAt(coords.x, coords.y);

    if (objectId) {
      const obj = state.doc.objects[objectId];
      if (obj && obj.type === 'text') {
        TextEditor.open(obj.x, obj.y, obj.text || '');
      }
    }
  }

  static handleMouseLeave() {
    state.isPanning = false;
  }

  static shouldStartPanning(event) {
    return (state.spaceHeld && event.button === 0) ||
        event.button === 1 ||
        state.tool === 'hand';
  }

  static startPanning(event) {
    state.isPanning = true;
    const rect = ui.canvas.getBoundingClientRect();
    state.lastCX = event.clientX - rect.left;
    state.lastCY = event.clientY - rect.top;
    event.preventDefault();
  }

  static startDragging(objectId, coords) {
    state.activeId = objectId;
    state.isDragging = true;
    const obj = state.doc.objects[objectId];
    if (!obj) return;

    state.dragStart = { x: coords.x, y: coords.y };
    if (obj.points) {
      const bounds = GeometryUtils.getBounds(obj);
      state.dragInitialPos = { x: bounds.x, y: bounds.y };
    } else {
      state.dragInitialPos = { x: obj.x, y: obj.y };
    }

    console.log('Starting drag:', { objectId, coords, initialPos: state.dragInitialPos });
  }

  static startDrawing(coords) {
    state.drawing = true;
    state.start = coords;
    const id = state.generateRandomId();

    switch (state.tool) {
      case 'pen':
      case 'eraser':
        DrawingTools.beginFreeDrawing(id, state.tool, coords.x, coords.y);
        break;
      case 'line':
      case 'arrow':
      case 'rect':
      case 'ellipse':
      case 'diamond':
        DrawingTools.beginShape(id, state.tool, coords.x, coords.y);
        break;
      case 'text': {
        // Clicking a shape with the text tool writes inside it; clicking bare
        // board starts free text where the pointer is.
        const id = DocumentManager.findTopObjectAt(coords.x, coords.y);
        const obj = id ? state.doc.objects[id] : null;

        if (obj && ['rect', 'ellipse', 'diamond', 'arrow', 'image'].includes(obj.type)) {
          state.drawing = false;
          state.selectedId = id;
          LabelEditor.open(obj);
        } else {
          TextEditor.open(coords.x, coords.y);
        }
        break;
      }
    }
  }

  static continuDrawing(coords) {
    if (state.tool === 'pen' || state.tool === 'eraser') {
      DrawingTools.addPoint(state.activeId, coords.x, coords.y);
    } else if (['line', 'rect', 'ellipse', 'diamond'].includes(state.tool)) {
      DrawingTools.resizeShape(state.activeId, coords.x, coords.y);
    }
  }

  static continueDragging(coords) {
    const obj = state.doc.objects[state.activeId];
    if (!obj || !state.dragStart || !state.dragInitialPos) return;

    const deltaX = coords.x - state.dragStart.x;
    const deltaY = coords.y - state.dragStart.y;
    const newX = state.dragInitialPos.x + deltaX;
    const newY = state.dragInitialPos.y + deltaY;

    if (obj.points) {
      const currentBounds = GeometryUtils.getBounds(obj);
      const moveX = newX - currentBounds.x;
      const moveY = newY - currentBounds.y;

      obj.points = obj.points.map(point => ({
        x: point.x + moveX,
        y: point.y + moveY
      }));
    } else {
      obj.x = newX;
      obj.y = newY;
    }

    obj.rev++;
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({
      t: 'move',
      id: obj.id,
      patch: {
        x: obj.x,
        y: obj.y,
        points: obj.points || null,
        rev: obj.rev
      }
    });
  }

  static startResizing(obj, handle, coords) {
    const b = GeometryUtils.getBounds(obj);

    state.resizing = {
      id: obj.id,
      handle,
      start: coords,
      // Work from the original box, so dragging back and forth is stable.
      origin: { x: b.x, y: b.y, w: b.w, h: b.h }
    };
  }

  /**
   * Resize from the handle being dragged, keeping the opposite side pinned.
   *
   * Shapes are stored as x, y, w, h where w and h may be negative, so the box
   * is normalised first and written back normalised.
   */
  static continueResizing(coords) {
    const r = state.resizing;
    const obj = state.doc.objects[r.id];
    if (!obj) return;

    const dx = coords.x - r.start.x;
    const dy = coords.y - r.start.y;

    let { x, y, w, h } = r.origin;

    if (r.handle.includes('e')) w += dx;
    if (r.handle.includes('s')) h += dy;
    if (r.handle.includes('w')) { x += dx; w -= dx; }
    if (r.handle.includes('n')) { y += dy; h -= dy; }

    // Do not let a shape collapse through itself.
    const MIN = 8;
    if (w < MIN) { x = Math.min(x, x + w - MIN); w = MIN; }
    if (h < MIN) { y = Math.min(y, y + h - MIN); h = MIN; }

    DocumentManager.updateObject(r.id, { x, y, w, h }, true);
  }

  static endResizing() {
    state.resizing = null;
  }

  static updateHover(coords, isShiftPressed) {
    const objectId = DocumentManager.findTopObjectAt(coords.x, coords.y);

    if (state.hoverId !== objectId) {
      state.hoverId = objectId;
      state.requestRender();
    }

    // With the text tool, show which object would receive the text.
    if (state.tool === 'text') {
      const obj = objectId ? state.doc.objects[objectId] : null;
      const labelable = obj && ['rect', 'ellipse', 'diamond', 'arrow', 'image'].includes(obj.type);
      ui.canvas.style.cursor = 'text';
      if (!labelable && state.hoverId) {
        state.hoverId = null;
        state.requestRender();
      }
      return;
    }

    // A handle on the selection wins: show which way it will resize.
    if (state.tool === 'select' && state.selectedId) {
      const selected = state.doc.objects[state.selectedId];
      const handle = ObjectRenderer.handleAt(selected, coords.x, coords.y);
      if (handle) {
        ui.canvas.style.cursor = ObjectRenderer.handleCursor(handle);
        return;
      }
    }

    // The cursor belongs to updateCursor(). This used to set it directly,
    // forcing a crosshair unless Shift was held, which silently undid
    // whatever the tool had asked for a few lines earlier.
    this.updateCursor(objectId, isShiftPressed);
  }

  static handlePanMove(event) {
    if (!state.isPanning) return;

    const rect = ui.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    const deltaX = clientX - state.lastCX;
    const deltaY = clientY - state.lastCY;

    state.panX += deltaX;
    state.panY += deltaY;
    state.lastCX = clientX;
    state.lastCY = clientY;

    CanvasManager.clampPan();
    state.requestRender();
    CursorManager.handleCanvasTransform();
  }

  static handlePanEnd() {
    state.isPanning = false;
  }

  // Touch handlers
  static handleTouchStart(event) {
    if (event.touches.length === 2) {
      state.touchPanning = true;
      state.lastTouchMid = this.getTouchMidpoint(event.touches[0], event.touches[1]);
      event.preventDefault();
    }
  }

  static handleTouchMove(event) {
    if (!state.touchPanning || event.touches.length !== 2) return;

    const midpoint = this.getTouchMidpoint(event.touches[0], event.touches[1]);
    state.panX += (midpoint.x - state.lastTouchMid.x);
    state.panY += (midpoint.y - state.lastTouchMid.y);
    state.lastTouchMid = midpoint;

    CanvasManager.clampPan();
    state.requestRender();
    event.preventDefault();
  }

  static handleTouchEnd(event) {
    state.touchPanning = false;
  }

  static getTouchMidpoint(touch1, touch2) {
    const rect = ui.canvas.getBoundingClientRect();
    return {
      x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
      y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
    };
  }
}

// ============================================================================
// CURSOR TRACKING - CORRECTED VERSION
// ============================================================================

class CursorManager {
  static init() {
    this.cursors = new Map();
    this.lastBroadcast = 0;
    this.broadcastThrottle = 16;
    this.animationFrame = null;

    // Smoothing configuration
    this.smoothingConfig = {
      easingFactor: 0.15, // Lower = smoother, higher = more responsive
      velocityDecay: 0.8, // Velocity decay for natural movement
      minDistance: 1, // Minimum distance to trigger movement
      maxVelocity: 50 // Maximum velocity per frame
    };

    document.addEventListener("mousemove", (event) => {
      this.updateLocalCursor(event);
    });

    // Start smooth animation loop for peer cursors
    this.startAnimationLoop();

    // Clean up stale cursors periodically
    setInterval(() => {
      this.cleanupStaleCursors();
    }, 5000);
  }

  static updateLocalCursor(event) {
    const now = Date.now();

    // Update local cursor position immediately (no interpolation needed)
    if (ui.mouse) {
      ui.mouse.style.left = `${event.clientX + 20}px`;
      ui.mouse.style.top = `${event.clientY + 20}px`;
      ui.mouse.style.transform = "translate(-50%, -50%)";
      ui.mouse.textContent = 'You';
    }

    // Throttle network broadcasts
    if (now - this.lastBroadcast < this.broadcastThrottle) {
      return;
    }

    this.lastBroadcast = now;

    // Convert to world coordinates for broadcasting
    const worldCoords = this.screenToWorld(event.clientX, event.clientY);

    // Broadcast world coordinates instead of canvas coordinates
    NetworkManager.broadcast({
      t: 'cursor',
      from: {
        name: state.peerName || `Peer-${state.localPeerId}`,
        id: state.localPeerId
      },
      worldX: worldCoords.x,
      worldY: worldCoords.y,
      timestamp: now
    });
  }

  static updatePeerCursor(peerId, peerName, cursorInfo) {
    if (peerId === state.localPeerId) {
      return; // Don't track our own cursor
    }

    const now = Date.now();

    // Convert world coordinates to screen coordinates
    const screenCoords = this.worldToScreen(cursorInfo.worldX, cursorInfo.worldY);

    let cursorData = this.cursors.get(peerId);

    if (!cursorData) {
      // Create new cursor data with element
      cursorData = {
        name: peerName,
        element: this.createPeerCursorElement(peerId, peerName),
        // Current position (for smooth interpolation)
        currentX: screenCoords.x,
        currentY: screenCoords.y,
        // Target position (where we want to move to)
        targetX: screenCoords.x,
        targetY: screenCoords.y,
        // Velocity for smoother movement
        velocityX: 0,
        velocityY: 0,
        // World coordinates (for recalculation on zoom/pan)
        worldX: cursorInfo.worldX,
        worldY: cursorInfo.worldY,
        lastUpdate: now,
        visible: true,
        lastFrameTime: now
      };

      this.cursors.set(peerId, cursorData);
    } else {
      // Calculate new target position
      const newTargetX = screenCoords.x;
      const newTargetY = screenCoords.y;

      // Update cursor data
      cursorData.name = peerName;
      cursorData.targetX = newTargetX;
      cursorData.targetY = newTargetY;
      cursorData.worldX = cursorInfo.worldX;
      cursorData.worldY = cursorInfo.worldY;
      cursorData.lastUpdate = now;
      cursorData.visible = true;
    }

    // Update cursor name if changed
    if (cursorData.element) {
      cursorData.element.textContent = peerName || `Peer-${peerId}`;
    }
  }

  static startAnimationLoop() {
    const animate = (timestamp) => {
      this.updateAllCursors(timestamp);
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  static updateAllCursors(timestamp) {
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (!cursorData.element || !cursorData.visible) continue;

      // Calculate delta time for frame-rate independent smoothing
      const deltaTime = Math.min(timestamp - cursorData.lastFrameTime, 50); // Cap at 50ms
      cursorData.lastFrameTime = timestamp;

      // Calculate distance to target
      const deltaX = cursorData.targetX - cursorData.currentX;
      const deltaY = cursorData.targetY - cursorData.currentY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Skip if we're close enough
      if (distance < this.smoothingConfig.minDistance) {
        continue;
      }

      // Calculate desired velocity with easing
      const easingFactor = this.smoothingConfig.easingFactor * (deltaTime / 16); // Normalize to 60fps
      const desiredVelX = deltaX * easingFactor;
      const desiredVelY = deltaY * easingFactor;

      // Apply velocity smoothing
      cursorData.velocityX = cursorData.velocityX * this.smoothingConfig.velocityDecay +
          desiredVelX * (1 - this.smoothingConfig.velocityDecay);
      cursorData.velocityY = cursorData.velocityY * this.smoothingConfig.velocityDecay +
          desiredVelY * (1 - this.smoothingConfig.velocityDecay);

      // Clamp velocity
      const velocity = Math.sqrt(cursorData.velocityX ** 2 + cursorData.velocityY ** 2);
      if (velocity > this.smoothingConfig.maxVelocity) {
        const scale = this.smoothingConfig.maxVelocity / velocity;
        cursorData.velocityX *= scale;
        cursorData.velocityY *= scale;
      }

      // Update position
      cursorData.currentX += cursorData.velocityX;
      cursorData.currentY += cursorData.velocityY;

      // Check if cursor is within viewport bounds with buffer
      const buffer = 100;
      const inBounds = cursorData.currentX >= -buffer &&
          cursorData.currentX <= window.innerWidth + buffer &&
          cursorData.currentY >= -buffer &&
          cursorData.currentY <= window.innerHeight + buffer;

      if (inBounds) {
        // Update element position with smooth values
        cursorData.element.style.left = `${Math.round(cursorData.currentX)}px`;
        cursorData.element.style.top = `${Math.round(cursorData.currentY)}px`;
        cursorData.element.style.opacity = '1';
        cursorData.element.style.visibility = 'visible';
      } else {
        // Fade out off-screen cursors
        cursorData.element.style.opacity = '0.3';
      }
    }
  }

  // Helper method to convert screen coordinates to world coordinates
  static screenToWorld(screenX, screenY) {
    const rect = ui.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    return {
      x: (canvasX - state.panX) / state.zoom,
      y: (canvasY - state.panY) / state.zoom
    };
  }

  // Helper method to convert world coordinates to screen coordinates
  static worldToScreen(worldX, worldY) {
    const rect = ui.canvas.getBoundingClientRect();
    const canvasX = worldX * state.zoom + state.panX;
    const canvasY = worldY * state.zoom + state.panY;
    return {
      x: canvasX + rect.left,
      y: canvasY + rect.top
    };
  }

  static createPeerCursorElement(peerId, peerName) {
    const { bg, text } = getRandomColorPair();
    const element = document.createElement('div');
    element.className = 'peer-cursor';
    element.dataset.peerId = peerId;

    // Enhanced styling for smoother appearance
    element.style.cssText = `
            position: fixed;
            left: 0px;
            top: 0px;
            width: fit-content;
            height: fit-content;
            background: ${bg};
            border-radius: 4px 50px 50px 50px;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            color: ${text};
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, -100%);
            will-change: transform, left, top;
            backface-visibility: hidden;
            transition: opacity 0 ease-out;
        `;

    element.textContent = peerName || `Peer-${peerId}`;
    document.body.appendChild(element);

    return element;
  }

  static updatePeerName(peerId, name) {
    state.peerNames.set(peerId, name);
    const cursorData = this.cursors.get(peerId);
    if (cursorData) {
      cursorData.name = name;
      if (cursorData.element) {
        cursorData.element.textContent = name || `Peer-${peerId}`;
      }
    }
  }

  static cleanupStaleCursors() {
    const now = Date.now();
    const staleThreshold = 10000; // 10 seconds

    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (now - cursorData.lastUpdate > staleThreshold) {
        this.removePeerCursor(peerId);
      }
    }
  }

  static removePeerCursor(peerId) {
    const cursorData = this.cursors.get(peerId);
    if (cursorData && cursorData.element) {
      // Fade out before removing
      cursorData.element.style.transition = 'opacity 200ms ease-out';
      cursorData.element.style.opacity = '0';

      setTimeout(() => {
        if (cursorData.element && cursorData.element.parentNode) {
          cursorData.element.parentNode.removeChild(cursorData.element);
        }
      }, 200);
    }

    this.cursors.delete(peerId);
    state.peerCursors.delete(peerId);
  }

  static handleWindowResize() {
    // Recalculate all cursor positions when window resizes
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (cursorData.visible && cursorData.worldX !== undefined && cursorData.worldY !== undefined) {
        // Recalculate screen position from world coordinates
        const newScreenCoords = this.worldToScreen(cursorData.worldX, cursorData.worldY);
        cursorData.targetX = newScreenCoords.x;
        cursorData.targetY = newScreenCoords.y;
        cursorData.currentX = newScreenCoords.x;
        cursorData.currentY = newScreenCoords.y;
      }
    }
  }

  // Called when canvas pan/zoom changes
  static handleCanvasTransform() {
    // Update all cursor positions based on new transform
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (cursorData.visible && cursorData.worldX !== undefined && cursorData.worldY !== undefined) {
        const newScreenCoords = this.worldToScreen(cursorData.worldX, cursorData.worldY);
        cursorData.targetX = newScreenCoords.x;
        cursorData.targetY = newScreenCoords.y;
      }
    }
  }

  static renderPeerCursors() {
    // This method is now mainly for compatibility
    // Most rendering is handled by the animation loop
  }

  static destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Clean up all cursor elements
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (cursorData.element && cursorData.element.parentNode) {
        cursorData.element.parentNode.removeChild(cursorData.element);
      }
    }

    this.cursors.clear();
  }
}

// ============================================================================
// USER INTERFACE
// ============================================================================

class UIManager {
  static init() {
    this.setupUserNameHandlers();
    this.setupToolHandlers();
    this.setupSessionHandlers();
    this.updateLocalPeerDisplay();
  }

  static setupUserNameHandlers() {
    document.querySelector('.peer-name-container').addEventListener('click', (e) => {
      e.preventDefault();
      ui.namePopup.classList.toggle('hidden');
    });

    ui.peerNameBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const username = ui.peerNameInput.value.trim();
      if (username.length > 0) {
        this.updateUserName(username);
      }
    });
  }

  static setupToolHandlers() {
    ui.tools.addEventListener('click', (e) => {
      const button = e.target;
      if (button && button.dataset.tool) {
        DrawingTools.selectTool(button.dataset.tool);
      }
    });

    ui.color.addEventListener('input', () => {
      state.strokeColor = ui.color.value;
      document.querySelector('#color-text').textContent = state.strokeColor
    });

    ui.size.addEventListener('input', () => {
      state.strokeSize = parseInt(ui.size.value, 10);
      document.querySelector('#size-text').textContent = state.strokeSize + ' px'
    });

    ui.opacitySlider.addEventListener('input', (e) => {
      state.strokeOpacity = parseFloat(e.target.value)
      document.querySelector('#opacity-text').textContent = state.strokeOpacity
    })

    ui.undo.addEventListener('click', () => HistoryManager.undo());
    ui.redo.addEventListener('click', () => HistoryManager.redo());
    ui.clear.addEventListener('click', () => DocumentManager.clearAll(true));
    ui.save.addEventListener('click', () => this.saveCanvasAsPNG());
    ui.saveState.addEventListener('click', () => this.saveDrawingState());
  }

  static async getRoomName() {
    return document.querySelector('#room-name-input').value.trim();
  }

  static setupSessionHandlers() {
    const setNameBtn = document.querySelector("#room-name-btn");
    const roomNameForm = document.querySelector("#room-name-form");

    // 1. Toggle the custom name form on Create click
    ui.createBtn.addEventListener("click", () => {
      roomNameForm.classList.remove("hidden");
      roomNameForm.style.display = "flex";
    });

    // 2. After entering name, create the room
    setNameBtn.addEventListener("click", async () => {
      const topic = crypto.randomBytes(32).toString("hex");
      const roomName = await this.getRoomName();
      if (!roomName) {
        alert("Please enter a room name");
        return;
      }

      const result = await room.addRoom(topic, roomName, state.peerName);
      if (result) {
        console.log("Room created:", await room.getRoom(topic));
        await room.broadcastRoomDetails(topic, true, null)
        SessionManager.startSession(topic);
      } else {
        alert("Failed to create room");
      }
    });

    // 3. Join existing room flow
    ui.joinBtn.addEventListener("click", async () => {
      const topic = document
          .querySelector("#join-canvas-topic")
          .value.trim();
      if (!topic) {
        alert("Enter a topic key");
        return;
      }

      const result = await room.addRoom(
          topic);
      console.log("Result:", result);

      if (result) {
        if (result.alreadyExists) {
          console.log("Joining existing room:", topic);
        } else {
          console.log("Room added and joining:", result);
        }
        SessionManager.startSession(topic);
      } else {
        alert("Failed to add room to your list");
      }
    });
  }

  static updateUserName(username) {
    CursorManager.updatePeerName(state.localPeerId, username);
    state.peerName = username;
    ui.localPeerName.innerHTML = state.peerName;
    ui.namePopup.classList.add('hidden');

    // Update the local mouse follower text
    if (ui.mouse) {
      ui.mouse.textContent = username || 'You';
    }

    console.log('Local Peer ID set to', state.localPeerId, 'Username:', username);
  }

  static updateLocalPeerDisplay() {
    ui.localPeerName.innerHTML = state.localPeerId;
    console.log('All State : ', this.state)
  }

  static updatePeerCount(count) {
    ui.peersCount.textContent = String(count + 1);
  }

  static saveCanvasAsPNG() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ui.canvas.width;
    tempCanvas.height = ui.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(ui.canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `whiteboard-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(dataUrl);
  }

  static async saveDrawingState() {
    if (!state.topicKey) {
      alert('No active room to save to');
      return;
    }

    const success = await room.addRoomState(state.topicKey);
    if (success) {
      alert('Drawing state saved to Hyperbee 🐝');
    } else {
      alert('Failed to save drawing state');
    }
  }

  /**
   * The drawing properties panel.
   *
   * Each row sets a value on `state`, which new shapes then pick up, and
   * applies immediately to the current selection so a chosen colour or width
   * can be seen straight away.
   */
  static setupPropertiesPanel() {
    const setActive = (row, match) => {
      row.querySelectorAll('.prop-btn, .swatch').forEach((btn) => {
        btn.classList.toggle('active', match(btn));
      });
    };

    // Applies a property to the selected object as well, when there is one.
    const applyToSelection = (patch) => {
      if (!state.selectedId) return;
      DocumentManager.updateObject(state.selectedId, patch, true);
    };

    // ---- colour ---------------------------------------------------------
    const swatchRow = document.querySelector('#colorGroup .swatch-row');
    if (swatchRow) {
      swatchRow.querySelectorAll('.swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
          const colour = btn.dataset.color;
          state.strokeColor = colour;
          if (ui.color) ui.color.value = colour;
          setActive(swatchRow, (b) => b.dataset.color === colour);
          applyToSelection({ color: colour });
        });
      });
      setActive(swatchRow, (b) => b.dataset.color === state.strokeColor);
    }

    if (ui.color) {
      ui.color.addEventListener('input', () => {
        state.strokeColor = ui.color.value;
        if (swatchRow) setActive(swatchRow, () => false);
        applyToSelection({ color: ui.color.value });
      });
    }

    // ---- background ------------------------------------------------------
    const bgRow = document.querySelector('#backgroundGroup .swatch-row');
    const bgInput = document.querySelector('#bg-color');
    if (bgRow) {
      bgRow.querySelectorAll('.swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
          const colour = btn.dataset.bg;
          state.backgroundColor = colour;
          if (bgInput && colour !== 'transparent') bgInput.value = colour;
          setActive(bgRow, (b) => b.dataset.bg === colour);
          applyToSelection({ backgroundColor: colour });
        });
      });
      setActive(bgRow, (b) => b.dataset.bg === state.backgroundColor);
    }

    if (bgInput) {
      bgInput.addEventListener('input', () => {
        state.backgroundColor = bgInput.value;
        if (bgRow) setActive(bgRow, () => false);
        applyToSelection({ backgroundColor: bgInput.value });
      });
    }

    // ---- fill style ------------------------------------------------------
    const fillRow = document.querySelector('#fillGroup .prop-row');
    if (fillRow) {
      fillRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.fillStyle = btn.dataset.fill;
          setActive(fillRow, (b) => b.dataset.fill === btn.dataset.fill);
          applyToSelection({ fillStyle: btn.dataset.fill });
        });
      });
      setActive(fillRow, (b) => b.dataset.fill === state.fillStyle);
    }

    // ---- edges -----------------------------------------------------------
    const edgesRow = document.querySelector('#edgesGroup .prop-row');
    if (edgesRow) {
      edgesRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.edges = btn.dataset.edges;
          setActive(edgesRow, (b) => b.dataset.edges === btn.dataset.edges);
          applyToSelection({ edges: btn.dataset.edges });
        });
      });
      setActive(edgesRow, (b) => b.dataset.edges === state.edges);
    }

    // ---- stroke width ----------------------------------------------------
    const widthRow = document.querySelector('#widthGroup .prop-row');
    if (widthRow) {
      widthRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const width = parseInt(btn.dataset.width, 10);
          state.strokeSize = width;
          if (ui.size) ui.size.value = String(width);
          setActive(widthRow, (b) => b.dataset.width === btn.dataset.width);
          applyToSelection({ size: width });
        });
      });
      setActive(widthRow, (b) => parseInt(b.dataset.width, 10) === state.strokeSize);
    }

    // ---- stroke style ----------------------------------------------------
    const styleRow = document.querySelector('#styleGroup .prop-row');
    if (styleRow) {
      styleRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.strokeStyle = btn.dataset.style;
          setActive(styleRow, (b) => b.dataset.style === btn.dataset.style);
          applyToSelection({ strokeStyle: btn.dataset.style });
        });
      });
      setActive(styleRow, (b) => b.dataset.style === state.strokeStyle);
    }

    // ---- sloppiness ------------------------------------------------------
    const sloppyRow = document.querySelector('#sloppinessGroup .prop-row');
    if (sloppyRow) {
      sloppyRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const level = parseInt(btn.dataset.sloppiness, 10);
          state.sloppiness = level;
          setActive(sloppyRow, (b) => b.dataset.sloppiness === btn.dataset.sloppiness);
          applyToSelection({ sloppiness: level });
        });
      });
      setActive(sloppyRow, (b) => parseInt(b.dataset.sloppiness, 10) === state.sloppiness);
    }

    // ---- arrow type ------------------------------------------------------
    const arrowRow = document.querySelector('#arrowTypeGroup .prop-row');
    if (arrowRow) {
      arrowRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.arrowType = btn.dataset.arrow;
          setActive(arrowRow, (b) => b.dataset.arrow === btn.dataset.arrow);
          applyToSelection({ arrowType: btn.dataset.arrow });
        });
      });
      setActive(arrowRow, (b) => b.dataset.arrow === state.arrowType);
    }

    // ---- pressure --------------------------------------------------------
    const pressureRow = document.querySelector('#pressureGroup .prop-row');
    if (pressureRow) {
      pressureRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.pressure = btn.dataset.pressure;
          setActive(pressureRow, (b) => b.dataset.pressure === btn.dataset.pressure);
          applyToSelection({ pressure: btn.dataset.pressure });
        });
      });
      setActive(pressureRow, (b) => b.dataset.pressure === state.pressure);
    }

    // ---- font family -----------------------------------------------------
    const fontRow = document.querySelector('#fontFamilyGroup .prop-row');
    if (fontRow) {
      fontRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.fontFamily = btn.dataset.font;
          setActive(fontRow, (b) => b.dataset.font === btn.dataset.font);
          applyToSelection({
            fontFamily: btn.dataset.font,
            font: FONT_STACKS[btn.dataset.font],
            labelFont: btn.dataset.font
          });
        });
      });
      setActive(fontRow, (b) => b.dataset.font === state.fontFamily);
    }

    // ---- font size -------------------------------------------------------
    const fontSizeRow = document.querySelector('#fontSizeGroup .prop-row');
    if (fontSizeRow) {
      fontSizeRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const size = parseInt(btn.dataset.size, 10);
          state.fontSize = size;
          setActive(fontSizeRow, (b) => b.dataset.size === btn.dataset.size);
          applyToSelection({ fontSize: size, labelSize: size });
        });
      });
      setActive(fontSizeRow, (b) => parseInt(b.dataset.size, 10) === state.fontSize);
    }

    // ---- text align ------------------------------------------------------
    const alignRow = document.querySelector('#textAlignGroup .prop-row');
    if (alignRow) {
      alignRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.textAlign = btn.dataset.align;
          setActive(alignRow, (b) => b.dataset.align === btn.dataset.align);
          applyToSelection({ align: btn.dataset.align, labelAlign: btn.dataset.align });
        });
      });
      setActive(alignRow, (b) => b.dataset.align === state.textAlign);
    }

    // ---- opacity ---------------------------------------------------------
    if (ui.opacitySlider) {
      const opacityText = document.querySelector('#opacity-text');
      ui.opacitySlider.addEventListener('input', () => {
        const percent = parseInt(ui.opacitySlider.value, 10);
        state.strokeOpacity = percent / 100;
        if (opacityText) opacityText.textContent = String(percent);
        applyToSelection({ opacity: state.strokeOpacity });
      });
    }

    // ---- layers ----------------------------------------------------------
    const layerRow = document.querySelector('#layersGroup .prop-row');
    if (layerRow) {
      layerRow.querySelectorAll('.prop-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!state.selectedId) {
            UIManager.showSaveStatus('Select something first');
            return;
          }
          DocumentManager.reorderObject(state.selectedId, btn.dataset.layer);
        });
      });
    }

    document.querySelectorAll('.prop-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.updateProperties();
      });
    });

    this.updateProperties();
  }

  /**
   * Which property groups apply to each kind of thing.
   *
   * Keyed by object type, with the drawing tools mapping onto the type they
   * produce. Anything not listed falls back to the common set.
   */
  static PROPERTY_GROUPS = {
    pen:     ['colorGroup', 'backgroundGroup', 'fillGroup', 'widthGroup', 'pressureGroup', 'opacityGroup', 'layersGroup'],
    line:    ['colorGroup', 'widthGroup', 'styleGroup', 'sloppinessGroup', 'opacityGroup', 'layersGroup'],
    arrow:   ['colorGroup', 'widthGroup', 'styleGroup', 'sloppinessGroup', 'arrowTypeGroup', 'fontFamilyGroup', 'fontSizeGroup', 'textAlignGroup', 'opacityGroup', 'layersGroup'],
    rect:    ['colorGroup', 'backgroundGroup', 'fillGroup', 'widthGroup', 'styleGroup', 'sloppinessGroup', 'edgesGroup', 'fontFamilyGroup', 'fontSizeGroup', 'textAlignGroup', 'opacityGroup', 'layersGroup'],
    ellipse: ['colorGroup', 'backgroundGroup', 'fillGroup', 'widthGroup', 'styleGroup', 'sloppinessGroup', 'fontFamilyGroup', 'fontSizeGroup', 'textAlignGroup', 'opacityGroup', 'layersGroup'],
    diamond: ['colorGroup', 'backgroundGroup', 'fillGroup', 'widthGroup', 'styleGroup', 'sloppinessGroup', 'edgesGroup', 'fontFamilyGroup', 'fontSizeGroup', 'textAlignGroup', 'opacityGroup', 'layersGroup'],
    text:    ['colorGroup', 'fontFamilyGroup', 'fontSizeGroup', 'textAlignGroup', 'opacityGroup', 'layersGroup'],
    image:   ['colorGroup', 'widthGroup', 'styleGroup', 'sloppinessGroup', 'backgroundGroup', 'fillGroup', 'edgesGroup', 'fontFamilyGroup', 'fontSizeGroup', 'textAlignGroup', 'opacityGroup', 'layersGroup'],
    eraser:  [],
    select:  [],
    hand:    []
  };

  /**
   * Show the properties that belong to whatever is in focus: the selected
   * object if there is one, otherwise the active drawing tool. Selecting
   * something opens the panel, as it does in the tools this follows.
   */
  static activeTab = 'stroke';

  static updateProperties({ open = false } = {}) {
    const selected = state.selectedId ? state.doc.objects[state.selectedId] : null;
    const kind = selected ? selected.type : state.tool;
    const groups = this.PROPERTY_GROUPS[kind] || this.PROPERTY_GROUPS.pen;

    // Which tabs have anything to show for this kind of object.
    const tabsWithContent = new Set();
    document.querySelectorAll('.prop-group').forEach((group) => {
      if (groups.includes(group.id)) tabsWithContent.add(group.dataset.tab);
    });

    // Fall back to a tab that has something in it.
    if (!tabsWithContent.has(this.activeTab)) {
      this.activeTab = tabsWithContent.has('stroke') ? 'stroke' : 'background';
    }

    document.querySelectorAll('.prop-group').forEach((group) => {
      const applies = groups.includes(group.id);
      const tab = group.dataset.tab;
      // 'common' groups — opacity and layers — show under either tab.
      const onTab = tab === 'common' || tab === this.activeTab;
      group.classList.toggle('hidden', !(applies && onTab));
    });

    document.querySelectorAll('.prop-tab').forEach((btn) => {
      const tab = btn.dataset.tab;
      btn.classList.toggle('active', tab === this.activeTab);
      btn.classList.toggle('hidden', !tabsWithContent.has(tab));
    });

    // With nothing to configure, leave the panel alone entirely.
    const panel = document.querySelector('.drawing-controls');
    if (panel) panel.classList.toggle('hidden', groups.length === 0);

    if (selected) this.syncPropertiesFrom(selected);

    if (open && groups.length > 0 && window.drawingControls) {
      window.drawingControls.toggle(true);
    }
  }

  /** Reflect an object's own values in the controls. */
  static syncPropertiesFrom(obj) {
    const mark = (selector, matches) => {
      document.querySelectorAll(selector).forEach((btn) => {
        btn.classList.toggle('active', matches(btn));
      });
    };

    mark('#colorGroup .swatch', (b) => b.dataset.color === obj.color);
    if (ui.color && obj.color) ui.color.value = obj.color;

    mark('#widthGroup .prop-btn', (b) => parseInt(b.dataset.width, 10) === obj.size);
    mark('#styleGroup .prop-btn', (b) => b.dataset.style === (obj.strokeStyle || 'solid'));
    mark('#sloppinessGroup .prop-btn', (b) => parseInt(b.dataset.sloppiness, 10) === (obj.sloppiness ?? 0));
    mark('#arrowTypeGroup .prop-btn', (b) => b.dataset.arrow === (obj.arrowType || 'straight'));
    mark('#backgroundGroup .swatch', (b) => b.dataset.bg === (obj.backgroundColor || 'transparent'));
    mark('#fillGroup .prop-btn', (b) => b.dataset.fill === (obj.fillStyle || 'solid'));
    mark('#edgesGroup .prop-btn', (b) => b.dataset.edges === (obj.edges || 'sharp'));
    mark('#fontFamilyGroup .prop-btn', (b) => b.dataset.font === (obj.fontFamily || 'hand'));
    mark('#fontSizeGroup .prop-btn', (b) => parseInt(b.dataset.size, 10) === (obj.fontSize || 20));
    mark('#textAlignGroup .prop-btn', (b) =>
      b.dataset.align === (obj.labelAlign || obj.align || 'center'));
    mark('#pressureGroup .prop-btn', (b) => b.dataset.pressure === (obj.pressure || 'variable'));

    const percent = Math.round((obj.opacity ?? 1) * 100);
    if (ui.opacitySlider) ui.opacitySlider.value = String(percent);
    const opacityText = document.querySelector('#opacity-text');
    if (opacityText) opacityText.textContent = String(percent);
  }

  /** Kept for callers that only care about the active tool. */
  static updatePropertiesForTool() {
    this.updateProperties();
  }

  /** Brief, unobtrusive confirmation that work is on disk. */
  static showSaveStatus(message, isError = false) {
    let el = document.querySelector('#save-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'save-status';
      document.body.appendChild(el);
    }

    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('visible');

    clearTimeout(this._saveStatusTimer);
    this._saveStatusTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, 1600);
  }

  static showSetup() {
    if (ui.slideIconContainer) ui.slideIconContainer.classList.add('hidden');
    ui.setup.classList.remove('hidden');
    ui.loading.classList.add('hidden');
    ui.toolbar.classList.add('hidden');
    ui.boardWrap.classList.add('hidden');
  }

  static showLoading() {
    ui.setup.classList.add('hidden');
    ui.loading.classList.remove('hidden');
    ui.toolbar.classList.add('hidden');
    ui.boardWrap.classList.add('hidden');
  }

  static showWorkspace() {
    ui.setup.classList.add('hidden');
    ui.loading.classList.add('hidden');
    ui.toolbar.classList.remove('hidden');
    ui.boardWrap.classList.remove('hidden');
    ui.peerCountBtn.classList.remove('hidden');
    ui.canvasRoomKey.classList.remove('hidden');
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

class SessionManager {
  static async startSession(topicHex) {
    if (state.joined) return;

    state.joined = true;
    state.topicKey = topicHex;

    UIManager.showLoading();
    ui.topicOut.dataset.value = topicHex;
    ui.topicOut.textContent = topicHex

    try {
      // Bring back whatever this room had, before showing it. Peers may
      // still send a newer document; applySnapshot ignores older versions.
      const saved = await room.getAutoState(topicHex);
      if (saved) {
        NetworkManager.applySnapshot(saved);
        console.log('Restored board from', new Date(saved.savedAt).toLocaleString());
      }

      await NetworkManager.initSwarm(topicHex);
      UIManager.showWorkspace();
      CanvasManager.resizeCanvas();
    } catch (error) {
      console.error('Failed to start networking:', error);
      alert('Failed to start networking');
      window.location.reload();
    }
  }
}

// ============================================================================
// AUTO-SAVE
// ============================================================================

/**
 * Keeps the board on disk without the user thinking about it.
 *
 * Writes are debounced: a burst of strokes produces one snapshot rather than
 * one per stroke. Hand-saved snapshots are untouched — this uses its own slot.
 */
export class AutoSave {
  static DELAY = 1500;
  static _timer = null;
  static _saving = false;
  static _again = false;

  /** Hook into document changes. Called once at startup. */
  static install() {
    state.onChange = () => this.schedule();

    // Best effort on the way out: the debounce may not have fired yet.
    window.addEventListener('beforeunload', () => { this.flush(); });
    window.addEventListener('pagehide', () => { this.flush(); });
  }

  static schedule() {
    if (!state.topicKey) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), this.DELAY);
  }

  static async flush() {
    if (!state.topicKey) return;

    clearTimeout(this._timer);
    this._timer = null;

    // A save already in flight: remember that more changes arrived.
    if (this._saving) {
      this._again = true;
      return;
    }

    this._saving = true;
    try {
      await room.saveAutoState(state.topicKey);
      UIManager.showSaveStatus('Saved');
    } catch (err) {
      console.error('Auto-save failed:', err);
      UIManager.showSaveStatus('Save failed', true);
    } finally {
      this._saving = false;
      if (this._again) {
        this._again = false;
        this.schedule();
      }
    }
  }
}

// ============================================================================
// NETWORK MANAGEMENT - FIXED VERSION
// ============================================================================

export class NetworkManager {
  static async initSwarm(topicHex) {
    state.swarm = new Hyperswarm();
    const topic = b4a.from(topicHex, 'hex');

    state.swarm.on('connection', (socket) => {
      this.setupConnection(socket);
    });

    await state.swarm.join(topic, { server: true, client: true });
    await state.swarm.flush();
  }

  static setupConnection(socket) {
    const peerId = crypto.randomBytes(4).toString('hex');
    const connection = { socket: socket, peerId: peerId, closed: false };

    state.connections.add(connection);
    state.peerCount = state.connections.size;
    UIManager.updatePeerCount(state.peerCount);

    console.log(`New peer connected: ${`peerId`}`);

    if (state.topicKey) {
      setTimeout(() => {
        room.setupReplication(state.topicKey, connection);
      }, 1000);
    }

    this.safeSend(connection, {
      t: 'hello',
      from: state.localPeerId,
      doc: this.serializeDocument(),
      requestRoomDetails: true,
      roomKey: state.topicKey
    });

    socket.on('data', (buffer) => {
      const message = this.decode(buffer);
      if (message) {
        this.handleRemoteMessage(message, connection);
      }
    });

    socket.once('close', () => {
      connection.closed = true;
      state.connections.delete(connection);
      state.peerCount = state.connections.size;
      UIManager.updatePeerCount(state.peerCount);
      console.log(`Peer disconnected: ${peerId}`);
    });

    socket.once('error', () => {
      connection.closed = true;
      state.connections.delete(connection);
      state.peerCount = state.connections.size;
      UIManager.updatePeerCount(state.peerCount);
    });
  }


  static queueOperation(operation) {
    state.outbox.push(operation);
    this.flushOutbox();
  }

  static flushOutbox() {
    if (state.flushing) return;
    state.flushing = true;

    while (state.outbox.length > 0) {
      const operation = state.outbox.shift();
      this.broadcast(operation);
    }

    state.flushing = false;
  }

  static broadcast(operation) {
    const payload = this.encode(operation);
    for (const connection of state.connections) {
      if (connection.closed) continue;
      try {
        connection.socket.write(payload);
      } catch (error) {
        // Connection dropped, ignore error
      }
    }
  }

  static safeSend(connection, object) {
    try {
      connection.socket.write(this.encode(object));
    } catch (error) {
      // Connection dropped, ignore error
    }
  }

  static serializeDocument() {
    return {
      version: state.doc.version,
      order: state.doc.order,
      objects: state.doc.objects
    };
  }

  static applySnapshot(snapshot) {
    if (!snapshot || (snapshot.version ?? -1) < (state.doc.version ?? -1)) {
      return;
    }

    state.doc.order = [...snapshot.order];
    state.doc.objects = {};
    for (const id of state.doc.order) {
      state.doc.objects[id] = snapshot.objects[id];
    }

    state.doc.version = snapshot.version;
    state.requestRender();
  }

  static async handleRemoteMessage(message) {
    switch (message.t) {
      case 'hello':
        console.log(`Hello from peer: ${message.from}`);
        this.applySnapshot(message.doc);
        if (message.requestRoomDetails && message.roomKey === state.topicKey) {
          const roomRecord = await room.getRoom(message.roomKey);
          console.log(roomRecord)
          const isCreator = roomRecord?.creator.name === globalState.getPeerName()
          console.log(isCreator)
          if (isCreator) {
            setTimeout(() => {
              room.broadcastRoomDetails(message.roomKey, true, message.from);
            }, 500);
          }
        }
        if (state.doc.version > (message.doc?.version ?? -1)) {
          this.broadcast({
            t: 'full',
            snapshot: this.serializeDocument()
          });
        }
        break;
      case 'room_details':
        this.handleRoomDetailsMessage(message);
        break;
      case 'full':
        this.applySnapshot(message.snapshot);
        break;
      case 'add':
        this.handleAddMessage(message);
        break;
      case 'update':
        this.handleUpdateMessage(message);
        break;
      case 'patch':
        this.handlePatchMessage(message);
        break;
      case 'touch':
        this.handleTouchMessage(message);
        break;
      case 'move':
        this.handleMoveMessage(message);
        break;
      case 'delete':
        this.handleDeleteMessage(message);
        break;
      case 'clear':
        DocumentManager.clearAll(false);
        break;
      case 'cursor':
        this.handleCursorMessage(message);
        break;
      case 'hypercore_saved':
        console.log('Peer', message.from, 'saved drawing to Hypercore at', new Date(message.savedAt));
        break;
      case 'hypercore_loaded':
        console.log(' Peer', message.from, 'loaded drawing from Hypercore, version:', message.loadedVersion);
        break;
      case 'room_state_added':
        console.log('Room state added from peer', message.from, 'version:', message.drawingState.version);
        break;
      case 'latestDrawing_loaded':
        console.log(' Peer', message.from, 'loaded drawing from Autobase, version:', message.drawingState.loadedVersion);
        break;
    }
  }

  static handleRoomDetailsMessage(message) {
    console.log('📥 Received room details from peer:', message.from);

    if (message.details && message.roomKey === state.topicKey) {
      this.updateLocalRoomInfo(message.details);
      console.log('✅ Room details updated:', message.details);
    }
  }

  static async updateLocalRoomInfo(roomDetails) {
    const updatedDetails = {
      roomName: roomDetails.roomName,
      createdBy: roomDetails.createdBy,
      createdAt: roomDetails.createdAt,
    };

    console.log('Updating local room details:', updatedDetails);

    console.log(state.localPeerId === roomDetails.createdBy);

    if(state.localPeerId !== updatedDetails.createdBy) await room.updateRoom(state.topicKey, updatedDetails);

    console.log(await room.getRoom(state.topicKey));
  }

  static handleAddMessage(message) {
    const obj = message.obj;
    if (state.doc.objects[obj.id]) return;

    state.doc.objects[obj.id] = obj;
    state.doc.order.push(obj.id);
    state.bumpDoc();
    state.requestRender();
  }

  static handleUpdateMessage(message) {
    const obj = state.doc.objects[message.id];
    if (!obj) return;

    // Last-writer-wins by revision number
    if ((message.patch.rev ?? 0) < (obj.rev ?? 0)) return;

    Object.assign(obj, message.patch);
    state.bumpDoc();
    state.requestRender();
  }

  static handlePatchMessage(message) {
    const obj = state.doc.objects[message.id];
    if (!obj || !obj.points) return;

    obj.points.push(message.push);
    obj.rev++;
    state.bumpDoc();
    state.requestRender();
  }

  static handleTouchMessage(message) {
    const obj = state.doc.objects[message.id];
    if (obj) {
      obj.rev++;
      state.bumpDoc();
      state.requestRender();
    }
  }

  static handleMoveMessage(message) {
    const obj = state.doc.objects[message.id];
    if (!obj) return;

    if ((message.patch.rev ?? 0) < (obj.rev ?? 0)) return;

    if (message.patch.points) {
      obj.points = message.patch.points;
    }

    obj.x = message.patch.x;
    obj.y = message.patch.y;
    obj.rev = message.patch.rev;
    state.bumpDoc();
    state.requestRender();
  }

  static handleDeleteMessage(message) {
    const id = message.id;
    if (!state.doc.objects[id]) return;

    delete state.doc.objects[id];
    state.doc.order = state.doc.order.filter(objId => objId !== id);
    state.bumpDoc();
    state.requestRender();
  }

  static handleCursorMessage(message) {
    // Ignore our own cursor updates
    if (message.from.id === state.localPeerId ||
        (message.from.name === state.peerName && message.from.name !== '')) {
      return;
    }

    // Validate message structure - now expects worldX/worldY instead of canvasX/canvasY
    if (!message.from || !message.from.id ||
        typeof message.worldX !== 'number' ||
        typeof message.worldY !== 'number') {
      return;
    }

    // Store cursor data for potential recalculations
    state.peerCursors.set(message.from.id, {
      name: message.from.name,
      cursor: {
        worldX: message.worldX,
        worldY: message.worldY,
        timestamp: message.timestamp || Date.now()
      }
    });

    // Update smooth cursor system with world coordinates
    CursorManager.updatePeerCursor(
        message.from.id,
        message.from.name || `Peer-${message.from.id}`,
        {
          worldX: message.worldX,
          worldY: message.worldY,
          timestamp: message.timestamp || Date.now()
        }
    );
  }

  static encode(object) {
    return b4a.from(JSON.stringify(object));
  }

  static decode(buffer) {
    try {
      return JSON.parse(b4a.toString(buffer));
    } catch (error) {
      return null;
    }
  }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

class WhiteboardApp {
  static async init() {
    state.localPeerId = await globalState.getPeerID()
    console.log(state.localPeerId)
    await initializeRoomList()

    CanvasManager.init();
    InputHandler.init();
    CursorManager.init();
    UIManager.init();

    DrawingTools.selectTool('pen');
    state.strokeColor = ui.color.value;
    state.strokeSize = parseInt(ui.size.value, 10);

    UIManager.setupPropertiesPanel();
    AutoSave.install();

    UIManager.showSetup();
  }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (window.__WB_BOOTED__) { console.warn('Boot skipped: already booted'); return; }
  window.__WB_BOOTED__ = true;
  console.log('WhiteboardApp.init called')
  await WhiteboardApp.init();

}, { once: true });

function initializeRoomList() {
  room.getAllRooms()
      .then(raw => {
        console.log('RAW ROOMS:', raw, typeof raw, Array.isArray(raw));
        let roomsArray = [];
        if (Array.isArray(raw)) {
          roomsArray = raw;
        }
        else if (raw && typeof raw === 'object') {
          roomsArray = Object.entries(raw).map(([key, value]) => ({ key, value }));
        }

        renderRoomList(roomsArray);
      })
      .catch(err => {
        console.error('Error loading rooms:', err);
        renderRoomList([]);
      });

  ui.roomsList.addEventListener('click', event => {
    const li = event.target.closest('.room-list');
    if (!li) return;
    SessionManager.startSession(li.dataset.value);
  });
}

// JavaScript
function renderRoomList(rooms) {
  const container = ui.roomsList;

  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<li>No rooms found.</li>';
    return;
  }

  const html = rooms
      .map((room) => `
      <li class="room-list" data-value="${room.key}" data-name="${room.value.roomName}">
        <h5 class="room-name">${room.value.roomName}</h5>
        <p class="room-date">
          Created: ${new Date(room.value.createdAt).toLocaleString()}
        </p>
        <i class="fas fa-trash delete-icon" title="Delete room"></i>
      </li>
    `)
      .join('');

  container.innerHTML = html;

  const icons = container.querySelectorAll('.delete-icon');
  icons.forEach((icon) => {
    icon.addEventListener('click', async (e) => {
      e.stopPropagation();
      const li = e.currentTarget.closest('.room-list');
      const roomKey = li.getAttribute('data-value');
      await room.deleteRoom(roomKey)
      await initializeRoomList();
      console.log('Delete room with key:', roomKey);
    });
  });
}


if (!window.__WB_EVENTS_BOUND__) {
  window.__WB_EVENTS_BOUND__ = true;
// Enhanced room key copying
  ui.canvasRoomKey.addEventListener('click', () => {
    const textToCopy = ui.topicOut.getAttribute('data-value')
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Room key copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  })

// Enhanced load state button with better feedback
  ui.loadStateBtn.addEventListener('click', async () => {
    if (ui.loadStateBtn.dataset.loading === '1') return;
    ui.loadStateBtn.dataset.loading = '1';
    try {
      const roomKey = ui.topicOut.getAttribute('data-value');
      console.log('Loading drawing state for room:', roomKey);

      const success = await room.loadLatestRoomState(roomKey);
      console.log('Success', success)
      if (success) {
        alert('Drawing loaded successfully!');
      } else {
        alert('No saved drawing found or failed to load');
      }
    } finally {
      ui.loadStateBtn.dataset.loading = '0';
    }
  });

  ui.slideStateBtn.addEventListener('click', async () => {
    const states = await room.loadAllStates(state.topicKey)
    await displayStates(states)
  })

  /**
   * Place an icon on the board, centred on the given world coordinates.
   * The image is loaded first so its natural size is known.
   */
  function insertIconAt(place, worldX, worldY) {
    const img = new Image();
    img.onload = () => {
      // The icon art is large (768x1344) and portrait. Scale the longest side
      // down to a sensible size on the board, keeping the proportions, so a
      // dropped icon is not enormous and is never distorted.
      const MAX_SIDE = 180;
      const longest = Math.max(img.width, img.height) || 1;
      const scale = Math.min(1, MAX_SIDE / longest);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const iconObj = {
        id: state.generateRandomId(),
        type: 'image',
        x: worldX - w / 2,
        y: worldY - h / 2,
        w,
        h,
        // Imported icons are referenced by id and resolved from the library at
        // render time. Only the bundled set keeps a path, which every peer has.
        libraryId: place.libraryId,
        iconId: place.iconId,
        src: place.libraryId === BUILTIN_ID ? place.source : undefined,
        // An image is a first-class object: it can sit on a coloured panel,
        // carry a caption and be connected by arrows, like any other shape.
        backgroundColor: 'transparent',
        color: state.strokeColor || '#1e1e1e',
        size: 0,               // no frame until one is chosen
        strokeStyle: state.strokeStyle || 'solid',
        sloppiness: state.sloppiness ?? 0,
        fillStyle: state.fillStyle || 'solid',
        edges: state.edges || 'round',
        opacity: state.strokeOpacity ?? 1,
        labelFont: state.fontFamily || 'hand',
        labelSize: state.fontSize || 20,
        labelAlign: 'center',
        labelColor: state.strokeColor || '#1e1e1e',
        createdBy: state.localPeerId,
        rev: 0
      };
      DocumentManager.addObject(iconObj, true);

      // Select what was just dropped and switch to the pointer, so its
      // properties are on screen and it can be moved straight away. Landing
      // an image and being shown the pen's settings is confusing.
      DrawingTools.selectTool('select');
      state.selectedId = iconObj.id;
      UIManager.updateProperties({ open: true });
      state.requestRender();
    };
    img.onerror = () => console.warn('Could not load icon:', place.iconId);
    img.src = place.source;
  }

  /**
   * Pointer-based dragging for the icon library.
   *
   * HTML5 drag-and-drop is unreliable inside an Electron renderer, and the
   * <img> in each row starts its own native image drag that swallows ours.
   * Tracking the pointer directly avoids both problems and behaves the same
   * on a trackpad, a mouse and a touchscreen.
   */
  const iconDrag = {
    place: null,
    ghost: null,

    start (place, event) {
      this.place = place;

      const ghost = document.createElement('img');
      ghost.src = place.source;
      ghost.className = 'icon-drag-ghost';
      document.body.appendChild(ghost);
      this.ghost = ghost;

      this.move(event);
      ui.canvas.classList.add('drop-target');

      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onCancel);
    },

    move (event) {
      if (!this.ghost) return;
      this.ghost.style.left = `${event.clientX}px`;
      this.ghost.style.top = `${event.clientY}px`;
    },

    finish (event) {
      const place = this.place;
      this.cleanup();
      if (!place) return;

      const rect = ui.canvas.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;

      if (!inside) return;

      const world = CoordinateUtils.screenToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top
      );
      insertIconAt(place, world.x, world.y);
    },

    cleanup () {
      this.place = null;
      if (this.ghost) {
        this.ghost.remove();
        this.ghost = null;
      }
      ui.canvas.classList.remove('drop-target');
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onCancel);
    }
  };

  iconDrag._onMove = (e) => iconDrag.move(e);
  iconDrag._onUp = (e) => iconDrag.finish(e);
  iconDrag._onCancel = () => iconDrag.cleanup();

  /** Which library the panel is showing. */
  let currentLibraryId = BUILTIN_ID;

  async function displayIcons() {
    // The button toggles the panel.
    if (!ui.slideIconContainer.classList.contains('hidden')) {
      ui.slideIconContainer.classList.add('hidden');
      return;
    }

    ui.slideIconContainer.classList.remove('hidden');
    await renderIconPanel();
  }

  async function renderIconPanel() {
    const container = ui.slideIconContainer;
    container.innerHTML = '';

    const libraries = await iconLibrary.listLibraries();
    if (!libraries.some(l => l.id === currentLibraryId)) {
      currentLibraryId = BUILTIN_ID;
    }
    const library = libraries.find(l => l.id === currentLibraryId);

    // ---- header ----------------------------------------------------------
    const header = document.createElement('div');
    header.className = 'icons-container-header';
    header.innerHTML = `
      <h3>Icons</h3>
      <button class="slide-icon-close" title="Close"><i class="fas fa-times"></i></button>
    `;
    header.querySelector('.slide-icon-close')
      .addEventListener('click', () => container.classList.add('hidden'));
    container.appendChild(header);

    // ---- library switcher ------------------------------------------------
    const bar = document.createElement('div');
    bar.className = 'library-bar';

    const select = document.createElement('select');
    select.className = 'library-select';
    for (const lib of libraries) {
      const opt = document.createElement('option');
      opt.value = lib.id;
      opt.textContent = lib.name;
      if (lib.id === currentLibraryId) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', async () => {
      currentLibraryId = select.value;
      await renderIconPanel();
    });
    bar.appendChild(select);

    const addLibBtn = document.createElement('button');
    addLibBtn.className = 'library-add';
    addLibBtn.title = 'New library';
    addLibBtn.textContent = '+';
    addLibBtn.addEventListener('click', () => showNewLibraryForm(container));
    bar.appendChild(addLibBtn);

    container.appendChild(bar);

    if (library && library.description) {
      const desc = document.createElement('p');
      desc.className = 'library-description';
      desc.textContent = library.description;
      container.appendChild(desc);
    }

    // ---- actions for custom libraries ------------------------------------
    if (library && !library.builtIn) {
      const actions = document.createElement('div');
      actions.className = 'library-actions';

      const importBtn = document.createElement('button');
      importBtn.className = 'library-import';
      importBtn.textContent = 'Add icons…';
      importBtn.addEventListener('click', () => pickAndImportIcons(library.id));
      actions.appendChild(importBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'library-delete';
      delBtn.textContent = 'Delete library';
      delBtn.addEventListener('click', async () => {
        await iconLibrary.deleteLibrary(library.id);
        currentLibraryId = BUILTIN_ID;
        await renderIconPanel();
      });
      actions.appendChild(delBtn);

      container.appendChild(actions);
    }

    // ---- icons -----------------------------------------------------------
    const wrapper = document.createElement('div');
    wrapper.className = 'icons-content-wrapper';

    const icons = await iconLibrary.listIcons(currentLibraryId);

    if (icons.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'no-icons-message';
      empty.textContent = library && library.builtIn
        ? 'No icons available.'
        : 'No icons yet — use “Add icons…” to bring some in.';
      wrapper.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'icons-list';

      for (const icon of icons) {
        const source = icon.src || icon.data;

        const item = document.createElement('li');
        item.className = 'icon-item';
        item.innerHTML = `
          <div class="icon-info">
            <img class="icon-thumbnail" src="${source}" alt="${icon.name}" title="${icon.name}">
          </div>
        `;

        const thumb = item.querySelector('.icon-thumbnail');
        if (thumb) thumb.draggable = false;
        item.draggable = false;

        const place = { source, libraryId: icon.libraryId, iconId: icon.id };

        item.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          iconDrag.start(place, e);
        });

        item.addEventListener('click', () => {
          const rect = ui.canvas.getBoundingClientRect();
          const centre = CoordinateUtils.screenToWorld(rect.width / 2, rect.height / 2);
          insertIconAt(place, centre.x, centre.y);
        });

        list.appendChild(item);
      }

      wrapper.appendChild(list);
    }

    container.appendChild(wrapper);
  }

  /** Inline form for naming a new library — no modal dialogs. */
  function showNewLibraryForm(container) {
    if (container.querySelector('.library-form')) return;

    const form = document.createElement('form');
    form.className = 'library-form';
    form.innerHTML = `
      <input class="library-name-input" type="text" placeholder="Library name" required>
      <textarea class="library-desc-input" rows="2" placeholder="Description (optional)"></textarea>
      <div class="library-form-actions">
        <button type="submit" class="library-create">Create</button>
        <button type="button" class="library-cancel">Cancel</button>
      </div>
    `;

    form.querySelector('.library-cancel')
      .addEventListener('click', () => form.remove());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.querySelector('.library-name-input').value;
      const description = form.querySelector('.library-desc-input').value;
      if (!name.trim()) return;

      const library = await iconLibrary.createLibrary(name, description);
      currentLibraryId = library.id;
      await renderIconPanel();
      pickAndImportIcons(library.id);
    });

    const bar = container.querySelector('.library-bar');
    bar.insertAdjacentElement('afterend', form);
    form.querySelector('.library-name-input').focus();
  }

  /** Open a file picker and import whatever images are chosen. */
  function pickAndImportIcons(libraryId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      input.remove();
      if (files.length === 0) return;

      UIManager.showSaveStatus(`Importing ${files.length}…`);

      let added = 0;
      for (const file of files) {
        try {
          const prepared = await importImageFile(file);
          await iconLibrary.addIcon(libraryId, prepared);
          added++;
        } catch (err) {
          console.error('Could not import', file.name, err);
        }
      }

      UIManager.showSaveStatus(
        added === files.length
          ? `Imported ${added}`
          : `Imported ${added} of ${files.length}`,
        added !== files.length
      );

      await renderIconPanel();
    });

    input.click();
  }


  // Clicking anywhere that is not the panel or its button closes it. It used
  // to stay open across rooms and sessions, covering the board.
  document.addEventListener('pointerdown', (e) => {
    const panel = ui.slideIconContainer;
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target)) return;
    if (ui.slideIconBtn && ui.slideIconBtn.contains(e.target)) return;
    panel.classList.add('hidden');
  });

  ui.slideIconBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    console.log('Icon button clicked');
    await displayIcons();
  });

  ui.slideIconCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.slideIconContainer.classList.add('hidden');
  });

  async function displayStates(states) {
    const container = document.getElementById('slide-state-container');
    const slideStateBtn = document.querySelector('.slide-state-btn');

    document.addEventListener('click', (event) => {
      if (container && !container.classList.contains('hidden')) {
        if (!container.contains(event.target) && !slideStateBtn.contains(event.target)) {
          container.classList.add('hidden');
        }
      }
    });

    container.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    container.classList.remove('hidden');

    if (!states || states.length === 0) {
      const emptyContainer = document.createElement('div');
      emptyContainer.className = 'empty-states';
      emptyContainer.innerHTML = `
            <div class="states-container-header">
                <h3>States</h3>
                <button class="slide-state-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <p class="no-states-message">No states available</p>
        `;

      const closeButton = emptyContainer.querySelector('.slide-state-close');
      closeButton.addEventListener('click', () => {
        container.classList.add('hidden');
      });

      container.innerHTML = '';
      container.appendChild(emptyContainer);
      return;
    }

    // Create container header with close button
    const containerHeader = document.createElement('div');
    containerHeader.className = 'states-container-header';
    containerHeader.innerHTML = `
        <h3>States</h3>
        <button class="slide-state-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add click handler to close button
    const closeButton = containerHeader.querySelector('.slide-state-close');
    closeButton.addEventListener('click', () => {
      container.classList.add('hidden');
    });

    // Create states list
    const statesList = document.createElement('ul');
    statesList.className = 'states-list';

    // Add states to the list
    states.forEach((state, index) => {
      const stateItem = document.createElement('li');
      stateItem.className = 'state-item';

      // Format timestamp
      const timestamp = new Date(state.savedAt).toLocaleString();
      const objectCount = state.order?.length || 0;

      stateItem.innerHTML = `
            <div class="state-info" data-index="${index}">
                <img class="state-thumbnail" src="${state.thumbnail}" alt="State preview">
                <div class="state-details">
                    <h5 class="state-index" style="background: #ffffff;padding: 4px;border-radius: 4px;">State ${index + 1}</h5>
                    <div style="display: flex; flex-direction: row; width: 100%; justify-content: space-between; flex-wrap: wrap;">
                    <p class="state-timestamp">${new Date(state.savedAt).toLocaleString()}</p>
                    <p class="object-count hidden">${state.order?.length || 0} objects</p>
                    <p class="saved-by">by ${state.savedBy}</p>
                    </div>
                    <i class="fas fa-trash delete-state" title="Delete room"></i>
                </div>
            </div>
        `;

      const deleteButton = stateItem.querySelector('.delete-state');
      deleteButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation()
        const updatedStates = await room.deleteState(state.roomKey, index);
        console.log('Updated states:', updatedStates)
        await displayStates(updatedStates)
        alert('State deleted successfully!');
      })

      stateItem.addEventListener('click', () => {
        Room.applyDrawingState(state);
      });

      statesList.appendChild(stateItem);
    });

    // Create wrapper for scrollable content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'states-content-wrapper';
    contentWrapper.appendChild(statesList);

    // Clear container and add new elements
    container.innerHTML = '';
    container.appendChild(containerHeader);
    container.appendChild(contentWrapper);
  }
// Enhanced room management
  document.getElementById('delete-all-state').addEventListener('click', async () => {
    const roomKey = document.getElementById('canvas-topic').getAttribute('data-value');
    if (!roomKey) {
      alert('No active room to delete');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete all your states in this room?`);
    if (confirmDelete) {
      const success = await room.deleteAllStates(roomKey);
      if (success) {
        alert('Room drawings deleted successfully');
      } else {
        alert('Failed to delete room drawings');
      }
    }
  });

  document.querySelectorAll('.room-list').forEach(room => {
    console.log(room)
    room.addEventListener('click', async () => {
      const roomKey = room.getAttribute('data-value');
      if (!roomKey) {
        alert('No active room to delete');
        return;
      }
    })
    room.addEventListener('click', () => {
      console.log('Clicked room:')
      const topic = room.dataset.value;
      console.log('Topic:', topic)
      if (topic) SessionManager.startSession(topic);
    });
  });

  // const version = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version
  // document.querySelector('#version').innerHTML = version;

  document.querySelector('#state-details').addEventListener('click', () => {
    console.log(state)
  })

  // Add this to your initialization code
  document.addEventListener('DOMContentLoaded', () => {
    const toggleRightPanel = document.getElementById('toggleRightPanel');
    const rightPanelContainer = document.getElementById('rightPanelContainer');

    toggleRightPanel.addEventListener('click', () => {
      const isExpanded = toggleRightPanel.getAttribute('aria-expanded') === 'true';
      toggleRightPanel.setAttribute('aria-expanded', !isExpanded);
      rightPanelContainer.classList.toggle('hidden');
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.right-top-data')) {
        toggleRightPanel.setAttribute('aria-expanded', 'false');
        rightPanelContainer.classList.add('hidden');
      }
    });
  });

// Export for potential external use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      WhiteboardApp,
      state,
      CanvasManager,
      DrawingTools,
      DocumentManager,
      NetworkManager,
      UIManager,
      HypercoreManager
    };
  }
}