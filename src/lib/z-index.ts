// ====================================================================
//  z-index.ts — Centralized z-index scale for Bisalasa v6.0
//  Use these constants everywhere instead of ad-hoc Tailwind classes.
//  Rules:
//    1. Higher number = appears on top
//    2. Backdrops are always 5 below their content
//    3. Tooltips are always above everything except modals
//    4. Game overlays respect the canvas frame
// ====================================================================

export const Z_INDEX = {
  // ---------- Base layers ----------
  /** Base page content */
  BASE: 0,
  /** Iframe stage (the slide canvas) */
  STAGE: 10,
  /** Whiteboard overlay (draws on top of canvas) */
  WHITEBOARD: 20,
  /** HUD inside the iframe stage (zoom indicator, corner buttons) */
  STAGE_HUD: 30,
  /** Virtual comment bubble (above stage HUD, below bottom-bar dropdowns).
   *  P1-2 fix: was hardcoded to 45 in VirtualCommentBubble, colliding with
   *  BOTTOM_BAR_DROPDOWN_BACKDROP. Now uses this dedicated constant. */
  VIRTUAL_COMMENT: 35,

  // ---------- Bottom bar ----------
  /** Bottom control bar (fixed at bottom) */
  BOTTOM_BAR: 30,
  /** Backdrop for bottom-bar dropdowns */
  BOTTOM_BAR_DROPDOWN_BACKDROP: 45,
  /** Bottom-bar dropdowns (game menus, etc.) */
  BOTTOM_BAR_DROPDOWN: 50,

  // ---------- Top bar ----------
  /** Top status bar (fixed at top) */
  TOP_BAR: 40,

  // ---------- Side rail ----------
  /** Floating side rail (right edge, fixed) */
  SIDE_RAIL: 40,
  /** Backdrop when a side panel or sub-menu is open */
  SIDE_PANEL_BACKDROP: 55,
  /** Sub-menus spawned from side rail buttons (e.g. tools dropdown) */
  SIDE_RAIL_SUBMENU: 80,
  /** Full side panel (380px column that slides in from right) */
  SIDE_PANEL: 60,

  // ---------- Teleprompter ----------
  /** Draggable teleprompter (script display) */
  TELEPROMPTER: 50,
  /** Notes overlay (above teleprompter) */
  NOTES_OVERLAY: 70,

  // ---------- Context menu ----------
  /** Right-click whiteboard context menu */
  CONTEXT_MENU_BACKDROP: 90,
  CONTEXT_MENU: 100,

  // ---------- Effects ----------
  /** Confetti and visual effects */
  EFFECTS: 110,
  /** Red/green flash overlays */
  FLASH: 115,

  // ---------- Modals ----------
  /** Generic modal dialog (e.g. game menu, student card) */
  MODAL_BACKDROP: 200,
  MODAL: 210,
  /** Critical modal (alerts, confirm) */
  CRITICAL_MODAL: 220,

  // ---------- Fullscreen ----------
  /** Fullscreen iframe stage (covers everything except critical modals) */
  FULLSCREEN_STAGE: 250,

  // ---------- Toasts ----------
  /** Toast notifications (always on top) */
  TOAST: 300,
} as const;

// ---------- Tailwind class helpers ----------
// Use these in className for consistent z-index across the app.

/** Side rail sub-menus (tools dropdown, stamp menu) */
export const Z_SIDE_RAIL_SUBMENU = "z-[80]";
/** Side rail sub-menu backdrop */
export const Z_SIDE_RAIL_SUBMENU_BACKDROP = "z-[75]";
/** Side panel that slides in from the right */
export const Z_SIDE_PANEL = "z-[60]";
/** Side panel backdrop (covers iframe but not rail) */
export const Z_SIDE_PANEL_BACKDROP = "z-[55]";
/** Teleprompter (script display) */
export const Z_TELEPROMPTER = "z-[50]";
/** Whiteboard context menu */
export const Z_CONTEXT_MENU = "z-[100]";
/** Whiteboard context menu backdrop */
export const Z_CONTEXT_MENU_BACKDROP = "z-[90]";
/** Modal overlay (covers everything except toasts) */
export const Z_MODAL = "z-[210]";
/** Modal backdrop */
export const Z_MODAL_BACKDROP = "z-[200]";
/** Toast notifications */
export const Z_TOAST = "z-[300]";
/** Fullscreen stage */
export const Z_FULLSCREEN = "z-[250]";
/** Effects layer (confetti, flashes) */
export const Z_EFFECTS = "z-[110]";

// ---------- Max-height helpers for scrollable panels ----------
// Use these inline styles to ensure long lists scroll within the panel.

/** Standard scrollable panel max height (covers most cases) */
export const SCROLL_MAX_HEIGHT = "calc(100vh - 80px)";
/** Tighter scroll height for sub-menus */
export const SCROLL_MAX_HEIGHT_SUBMENU = "calc(100vh - 120px)";
/** For full side panels (with header) */
export const SCROLL_MAX_HEIGHT_PANEL = "calc(100vh - 60px)";
