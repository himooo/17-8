/**
 * Whiteboard V10 contracts and deterministic helpers.
 *
 * The module is browser-agnostic on purpose: it is used by the canvas UI,
 * local recovery, exports, and smoke tests without requiring React or a DOM.
 */

export type WhiteboardPoint = {
  x: number;
  y: number;
  t?: number;
  pressure?: number;
};

export type WhiteboardStrokeKind = "path" | "shape" | "text" | "equation" | "stamp";
export type WhiteboardShape = "circle" | "rectangle" | "triangle" | "line" | "arrow";

export interface WhiteboardStrokeV10 {
  id: string;
  kind: WhiteboardStrokeKind;
  tool?: string;
  points: WhiteboardPoint[];
  color: string;
  thickness: number;
  layerId: string;
  visible?: boolean;
  locked?: boolean;
  shape?: WhiteboardShape;
  text?: string;
  latex?: string;
  fontSize?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface WhiteboardLayerV10 {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface WhiteboardPageV10 {
  id: string;
  name: string;
  slideKey: string;
  layers: WhiteboardLayerV10[];
  strokes: WhiteboardStrokeV10[];
  createdAt: number;
  updatedAt: number;
}

export interface WhiteboardDocumentV10 {
  version: 10;
  slideKey: string;
  activePageId: string;
  grid: { enabled: boolean; size: number; snap: boolean };
  pages: WhiteboardPageV10[];
}

export type ReplayFrame = {
  strokeId: string;
  pointIndex: number;
  point: WhiteboardPoint;
  elapsedMs: number;
};

const DEFAULT_LAYER_ID = "layer-main";

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "board";
}

export function createWhiteboardDocument(slideKey: string, now = Date.now()): WhiteboardDocumentV10 {
  const pageId = `${safeIdPart(slideKey)}-page-1`;
  return {
    version: 10,
    slideKey,
    activePageId: pageId,
    grid: { enabled: false, size: 20, snap: false },
    pages: [{
      id: pageId,
      name: "صفحة 1",
      slideKey,
      layers: [{ id: DEFAULT_LAYER_ID, name: "الطبقة الرئيسية", visible: true, locked: false, order: 0 }],
      strokes: [],
      createdAt: now,
      updatedAt: now,
    }],
  };
}

export function normalizeWhiteboardDocument(input: unknown, slideKey: string, now = Date.now()): WhiteboardDocumentV10 {
  const fallback = createWhiteboardDocument(slideKey, now);
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<WhiteboardDocumentV10>;
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  const normalizedPages = pages.map((rawPage, pageIndex): WhiteboardPageV10 => {
    const page = rawPage as Partial<WhiteboardPageV10>;
    const pageId = typeof page.id === "string" && page.id ? page.id : `${safeIdPart(slideKey)}-page-${pageIndex + 1}`;
    const layers = Array.isArray(page.layers) && page.layers.length > 0
      ? page.layers.map((layer, order) => ({
          id: typeof layer.id === "string" && layer.id ? layer.id : `layer-${order + 1}`,
          name: typeof layer.name === "string" && layer.name ? layer.name : `طبقة ${order + 1}`,
          visible: layer.visible !== false,
          locked: layer.locked === true,
          order: Number.isFinite(layer.order) ? Number(layer.order) : order,
        }))
      : [{ id: DEFAULT_LAYER_ID, name: "الطبقة الرئيسية", visible: true, locked: false, order: 0 }];
    const strokes = Array.isArray(page.strokes) ? page.strokes.filter(Boolean).map((stroke, index) => {
      const s = stroke as Partial<WhiteboardStrokeV10>;
      return {
        id: typeof s.id === "string" && s.id ? s.id : `stroke-${index + 1}`,
        kind: ["path", "shape", "text", "equation", "stamp"].includes(String(s.kind)) ? s.kind as WhiteboardStrokeKind : "path",
        tool: typeof s.tool === "string" ? s.tool : undefined,
        points: Array.isArray(s.points) ? s.points.filter((point) => point && Number.isFinite((point as WhiteboardPoint).x) && Number.isFinite((point as WhiteboardPoint).y)).map((point) => ({
          x: Number((point as WhiteboardPoint).x),
          y: Number((point as WhiteboardPoint).y),
          t: Number.isFinite((point as WhiteboardPoint).t) ? Number((point as WhiteboardPoint).t) : undefined,
          pressure: Number.isFinite((point as WhiteboardPoint).pressure) ? Math.max(0, Math.min(1, Number((point as WhiteboardPoint).pressure))) : undefined,
        })) : [],
        color: typeof s.color === "string" && s.color ? s.color : "#2563eb",
        thickness: Number.isFinite(s.thickness) ? Math.max(1, Math.min(80, Number(s.thickness))) : 2,
        layerId: typeof s.layerId === "string" && s.layerId ? s.layerId : layers[0].id,
        visible: s.visible !== false,
        locked: s.locked === true,
        shape: s.shape,
        text: typeof s.text === "string" ? s.text.slice(0, 4000) : undefined,
        latex: typeof s.latex === "string" ? s.latex.slice(0, 4000) : undefined,
        fontSize: Number.isFinite(s.fontSize) ? Math.max(8, Math.min(160, Number(s.fontSize))) : undefined,
        metadata: s.metadata && typeof s.metadata === "object" ? s.metadata : undefined,
      };
    }) : [];
    return {
      id: pageId,
      name: typeof page.name === "string" && page.name ? page.name.slice(0, 100) : `صفحة ${pageIndex + 1}`,
      slideKey,
      layers,
      strokes,
      createdAt: Number.isFinite(page.createdAt) ? Number(page.createdAt) : now,
      updatedAt: Number.isFinite(page.updatedAt) ? Number(page.updatedAt) : now,
    };
  });
  const safePages = normalizedPages.length > 0 ? normalizedPages : fallback.pages;
  const activePageId = safePages.some((page) => page.id === raw.activePageId) ? String(raw.activePageId) : safePages[0].id;
  return {
    version: 10,
    slideKey,
    activePageId,
    grid: {
      enabled: raw.grid?.enabled === true,
      size: Number.isFinite(raw.grid?.size) ? Math.max(4, Math.min(200, Number(raw.grid?.size))) : 20,
      snap: raw.grid?.snap === true,
    },
    pages: safePages,
  };
}

export function addWhiteboardPage(document: WhiteboardDocumentV10, name?: string, now = Date.now()): WhiteboardDocumentV10 {
  const pageNumber = document.pages.length + 1;
  const id = `${safeIdPart(document.slideKey)}-page-${pageNumber}-${now}`;
  const page: WhiteboardPageV10 = {
    id,
    name: name?.trim().slice(0, 100) || `صفحة ${pageNumber}`,
    slideKey: document.slideKey,
    layers: [{ id: `${id}-layer-main`, name: "الطبقة الرئيسية", visible: true, locked: false, order: 0 }],
    strokes: [],
    createdAt: now,
    updatedAt: now,
  };
  return { ...document, activePageId: id, pages: [...document.pages, page] };
}

export function removeWhiteboardPage(document: WhiteboardDocumentV10, pageId: string): WhiteboardDocumentV10 {
  if (document.pages.length <= 1) return document;
  const pages = document.pages.filter((page) => page.id !== pageId);
  if (pages.length === document.pages.length) return document;
  const activePageId = document.activePageId === pageId ? pages[pages.length - 1].id : document.activePageId;
  return { ...document, activePageId, pages };
}

export function setActiveWhiteboardPage(document: WhiteboardDocumentV10, pageId: string): WhiteboardDocumentV10 {
  return document.pages.some((page) => page.id === pageId) ? { ...document, activePageId: pageId } : document;
}

export function updateWhiteboardLayer(document: WhiteboardDocumentV10, pageId: string, layerId: string, patch: Partial<Pick<WhiteboardLayerV10, "name" | "visible" | "locked" | "order">>): WhiteboardDocumentV10 {
  return {
    ...document,
    pages: document.pages.map((page) => page.id !== pageId ? page : {
      ...page,
      updatedAt: Date.now(),
      layers: page.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch, name: patch.name?.trim().slice(0, 100) || layer.name } : layer),
    }),
  };
}

export function addWhiteboardLayer(document: WhiteboardDocumentV10, pageId: string, name = "طبقة جديدة"): WhiteboardDocumentV10 {
  return {
    ...document,
    pages: document.pages.map((page) => {
      if (page.id !== pageId) return page;
      const id = `${pageId}-layer-${page.layers.length + 1}-${Date.now()}`;
      return { ...page, updatedAt: Date.now(), layers: [...page.layers, { id, name: name.trim().slice(0, 100) || "طبقة جديدة", visible: true, locked: false, order: page.layers.length }] };
    }),
  };
}

export function renderEquationText(latex: string): string {
  const value = latex.trim().slice(0, 4000);
  if (!value) return "";
  return value
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\$/g, "")
    .replace(/[{}]/g, "")
    .trim();
}

export function snapLineGeometry(stroke: WhiteboardStrokeV10, existing: WhiteboardStrokeV10[], toleranceDegrees = 6): WhiteboardStrokeV10 {
  if (stroke.points.length < 2) return stroke;
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  const angle = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
  const normalized = ((angle % 180) + 180) % 180;
  const nearestAxis = [0, 45, 90, 135].reduce((best, candidate) => Math.abs(candidate - normalized) < Math.abs(best - normalized) ? candidate : best, 0);
  const axisDistance = Math.abs(nearestAxis - normalized);
  let next = stroke;
  if (axisDistance <= toleranceDegrees) {
    const radians = (nearestAxis * Math.PI) / 180;
    const length = Math.hypot(last.x - first.x, last.y - first.y);
    next = { ...next, points: [first, { ...last, x: first.x + Math.cos(radians) * length, y: first.y + Math.sin(radians) * length }], metadata: { ...stroke.metadata, snapped: true, snappedAngle: nearestAxis } };
  }
  const existingLines = existing.filter((candidate) => candidate.points.length >= 2 && (candidate.kind === "path" || candidate.kind === "shape" || candidate.kind === "equation"));
  for (const candidate of existingLines) {
    const a = candidate.points[0];
    const b = candidate.points[candidate.points.length - 1];
    const candidateAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const difference = Math.abs((((angle - candidateAngle) % 180) + 180) % 180);
    const relation = difference <= toleranceDegrees || Math.abs(difference - 180) <= toleranceDegrees ? "parallel" : Math.abs(difference - 90) <= toleranceDegrees ? "perpendicular" : undefined;
    if (relation) return { ...next, metadata: { ...next.metadata, relation, relatedStrokeId: candidate.id } };
  }
  return next;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function pointsAttribute(points: WhiteboardPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

export function exportWhiteboardSvg(document: WhiteboardDocumentV10, width: number, height: number): string {
  const page = document.pages.find((item) => item.id === document.activePageId) || document.pages[0];
  const visibleLayers = new Set((page?.layers || []).filter((layer) => layer.visible).map((layer) => layer.id));
  const body = (page?.strokes || []).filter((stroke) => stroke.visible !== false && visibleLayers.has(stroke.layerId)).map((stroke) => {
    const points = stroke.points;
    const color = escapeXml(stroke.color);
    if (stroke.kind === "text" || stroke.kind === "equation") {
      const label = escapeXml(stroke.kind === "equation" ? renderEquationText(stroke.latex || stroke.text || "") : stroke.text || "");
      const point = points[0] || { x: 0, y: 0 };
      return `<text x="${point.x}" y="${point.y}" fill="${color}" font-size="${stroke.fontSize || 24}" font-family="sans-serif">${label}</text>`;
    }
    if (stroke.shape === "rectangle" && points.length >= 2) {
      const start = points[0]; const end = points[points.length - 1];
      return `<rect x="${Math.min(start.x, end.x)}" y="${Math.min(start.y, end.y)}" width="${Math.abs(end.x - start.x)}" height="${Math.abs(end.y - start.y)}" fill="none" stroke="${color}" stroke-width="${stroke.thickness}" />`;
    }
    return points.length >= 2 ? `<polyline points="${pointsAttribute(points)}" fill="none" stroke="${color}" stroke-width="${stroke.thickness}" stroke-linecap="round" stroke-linejoin="round" />` : "";
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(width))}" height="${Math.max(1, Math.round(height))}" viewBox="0 0 ${Math.max(1, Math.round(width))} ${Math.max(1, Math.round(height))}"><rect width="100%" height="100%" fill="transparent" />${body}</svg>`;
}

export function buildReplayFrames(strokes: WhiteboardStrokeV10[], speed = 1): ReplayFrame[] {
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? Math.min(8, speed) : 1;
  const frames: ReplayFrame[] = [];
  let elapsed = 0;
  for (const stroke of strokes) {
    const points = stroke.points || [];
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[index - 1];
      const distance = previous ? Math.hypot(points[index].x - previous.x, points[index].y - previous.y) : 0;
      elapsed += Math.max(8, Math.round((distance + 8) / safeSpeed));
      frames.push({ strokeId: stroke.id, pointIndex: index, point: points[index], elapsedMs: elapsed });
    }
  }
  return frames;
}

export function whiteboardDocumentStorageKey(slideKey: string): string {
  return `bisalasa:whiteboard:v10:${safeIdPart(slideKey)}`;
}
