import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { SlideManifest, SlideStep } from "./slide-schema";

export interface PdfExportOptions {
  filename: string;
  title?: string;
  orientation?: "portrait" | "landscape";
  scale?: number;
}

export interface SlideExportNavigation {
  currentStep: number;
  currentIdeaId: string | null;
  goToStep: (step: number, ideaId?: string) => void;
}

interface ExportStep {
  step: number;
  ideaId?: string;
  ideaTitle?: string;
  data: SlideStep & { ideaId?: string; ideaTitle?: string };
}

function safeFilename(filename: string): string {
  const normalized = filename.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${normalized || "bisalasa-report"}.pdf`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForStableFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await wait(220);
}

function flattenManifest(manifest: SlideManifest): ExportStep[] {
  if (manifest.ideas?.length) {
    return manifest.ideas.flatMap((idea) => idea.steps.map((data) => ({
      step: data.step,
      ideaId: idea.id,
      ideaTitle: idea.title,
      data: { ...data, ideaId: idea.id, ideaTitle: idea.title },
    })));
  }
  return (manifest.steps ?? []).map((data) => ({ step: data.step, data }));
}

function getVisibleIframe(): HTMLIFrameElement {
  const iframe = document.querySelector<HTMLIFrameElement>(".iframe-visible-area iframe");
  if (!iframe) throw new Error("لا توجد شريحة مرئية لالتقاطها");
  if (!iframe.contentDocument?.documentElement) throw new Error("لم تكتمل جاهزية الشريحة الداخلية");
  return iframe;
}

/** Capture the actual imported lesson document, not the outer shell. */
async function captureCurrentSlideCanvas(): Promise<HTMLCanvasElement> {
  const iframe = getVisibleIframe();
  const doc = iframe.contentDocument;
  if (!doc?.documentElement) throw new Error("تعذر الوصول إلى محتوى الشريحة");
  const root = doc.documentElement;
  const width = Math.max(1, root.scrollWidth, iframe.clientWidth);
  const height = Math.max(1, root.scrollHeight, iframe.clientHeight);
  const canvas = await html2canvas(root, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  });
  if (canvas.width < 2 || canvas.height < 2) throw new Error("تم التقاط شريحة فارغة");
  return canvas;
}

function addCanvasToPdf(pdf: any, canvas: HTMLCanvasElement, x: number, y: number, maxWidth: number, maxHeight: number): number {
  const ratio = canvas.width / Math.max(canvas.height, 1);
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  const image = canvas.toDataURL("image/png");
  pdf.addImage(image, "PNG", x + (maxWidth - width) / 2, y, width, height, undefined, "FAST");
  return height;
}

function appendTextBlock(parent: HTMLElement, text: string, style: string): void {
  const node = document.createElement("div");
  node.textContent = text;
  node.style.cssText = style;
  parent.appendChild(node);
}

async function renderArabicCard(title: string, subtitle: string, body: string[] = []): Promise<HTMLCanvasElement> {
  const wrapper = document.createElement("div");
  wrapper.dir = "rtl";
  wrapper.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    "width:1100px",
    "box-sizing:border-box",
    "padding:56px",
    "background:#ffffff",
    "color:#0f172a",
    "font-family:Arial, Tahoma, sans-serif",
    "line-height:1.7",
    "direction:rtl",
    "text-align:right",
  ].join(";");
  appendTextBlock(wrapper, title, "font-size:34px;font-weight:800;color:#0142a0;margin-bottom:8px;");
  appendTextBlock(wrapper, subtitle, "font-size:18px;color:#475569;margin-bottom:28px;");
  for (const line of body) appendTextBlock(wrapper, line, "font-size:17px;color:#1e293b;border-top:1px solid #e2e8f0;padding:12px 0;");
  document.body.appendChild(wrapper);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    return await html2canvas(wrapper, { backgroundColor: "#ffffff", scale: 2, logging: false, width: wrapper.scrollWidth, height: wrapper.scrollHeight });
  } finally {
    wrapper.remove();
  }
}

async function renderTeacherMeta(step: ExportStep, lessonTitle: string): Promise<HTMLCanvasElement> {
  const data = step.data;
  const body: string[] = [];
  if (step.ideaTitle) body.push(`الفكرة: ${step.ideaTitle}`);
  if (data.script) body.push(`الشرح: ${Array.isArray(data.script) ? data.script.join(" ") : data.script}`);
  if (data.notes) body.push(`ملاحظات المدرس: ${data.notes}`);
  if (data.question?.text) body.push(`السؤال: ${data.question.text}`);
  if (data.question?.correctAnswer !== undefined) body.push(`الإجابة المعتمدة: ${String(data.question.correctAnswer)}`);
  return renderArabicCard(`الشريحة ${step.step}: ${data.title ?? ""}`, `الدرس: ${lessonTitle}`, body);
}

/**
 * Export every real lesson slide. The navigation callback changes the visible
 * iframe, then the iframe document itself is captured, so imported HTML/React
 * slides keep their original visual layout instead of becoming a text summary.
 */
export async function exportLessonSlidesToPdf(input: {
  manifest: SlideManifest | null;
  activeLesson: { content: string; title: string } | null;
  navigation: SlideExportNavigation;
  teacherCopy?: boolean;
  filename: string;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { manifest, activeLesson, navigation, teacherCopy = false } = input;
  if (!manifest || !activeLesson) throw new Error("لا يوجد درس محمّل");
  const steps = flattenManifest(manifest);
  if (!steps.length) throw new Error("لا توجد شرائح في هذا الدرس");

  const originalStep = navigation.currentStep;
  const originalIdeaId = navigation.currentIdeaId;
  const portrait = manifest.aspectRatio === "9:16";
  const orientation = portrait ? "portrait" : "landscape";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const margin = 10;
  const pageWidth = portrait ? 210 : 297;
  const pageHeight = portrait ? 297 : 210;
  const contentWidth = pageWidth - margin * 2;

  try {
    const cover = await renderArabicCard(
      teacherCopy ? `نسخة المدرس — ${activeLesson.title}` : `نسخة الطالب — ${activeLesson.title}`,
      `${steps.length} شريحة • الشرائح الأصلية محفوظة كلقطة كاملة`,
      [teacherCopy ? "تتضمن كل شريحة مع شرحها وملاحظاتها وإجاباتها." : "تتضمن الشرائح كما تظهر في العرض، دون بيانات الطلاب أو أدوات غرفة العمليات."]
    );
    addCanvasToPdf(pdf, cover, margin, 25, contentWidth, pageHeight - 40);

    for (let index = 0; index < steps.length; index += 1) {
      const item = steps[index];
      navigation.goToStep(item.step, item.ideaId);
      await waitForStableFrame();
      const slideCanvas = await captureCurrentSlideCanvas();
      pdf.addPage("a4", orientation);
      const metaHeight = portrait ? 78 : 47;
      const slideMaxHeight = teacherCopy ? pageHeight - margin * 2 - metaHeight - 8 : pageHeight - margin * 2;
      addCanvasToPdf(pdf, slideCanvas, margin, 12, contentWidth, slideMaxHeight);

      if (teacherCopy) {
        const meta = await renderTeacherMeta(item, activeLesson.title);
        addCanvasToPdf(pdf, meta, margin, pageHeight - margin - metaHeight, contentWidth, metaHeight);
      }
      input.onProgress?.(index + 1, steps.length);
    }
  } finally {
    navigation.goToStep(originalStep, originalIdeaId ?? undefined);
  }
  pdf.save(safeFilename(input.filename));
}

/** Capture the current slide and merge the visible whiteboard canvases on top. */
export async function exportCurrentStageToPdf(options: Omit<PdfExportOptions, "filename"> & { filename?: string } = {}): Promise<void> {
  const stage = document.querySelector<HTMLElement>(".iframe-visible-area");
  if (!stage) throw new Error("منطقة العرض غير متاحة للتصدير");
  const iframe = stage.querySelector<HTMLIFrameElement>("iframe");
  if (!iframe?.contentDocument?.documentElement) {
    await exportElementToPdf(stage, { ...options, filename: options.filename ?? `بسلاسة-الشريحة-${new Date().toISOString().slice(0, 10)}` });
    return;
  }

  const slide = await captureCurrentSlideCanvas();
  const composite = document.createElement("canvas");
  composite.width = slide.width;
  composite.height = slide.height;
  const ctx = composite.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز لقطة PDF");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, composite.width, composite.height);
  ctx.drawImage(slide, 0, 0);

  const iframeRect = iframe.getBoundingClientRect();
  const canvases = Array.from(stage.querySelectorAll<HTMLCanvasElement>("canvas"));
  for (const board of canvases) {
    const rect = board.getBoundingClientRect();
    const x = ((rect.left - iframeRect.left) / Math.max(iframeRect.width, 1)) * slide.width;
    const y = ((rect.top - iframeRect.top) / Math.max(iframeRect.height, 1)) * slide.height;
    const width = (rect.width / Math.max(iframeRect.width, 1)) * slide.width;
    const height = (rect.height / Math.max(iframeRect.height, 1)) * slide.height;
    ctx.drawImage(board, x, y, width, height);
  }

  const orientation = options.orientation ?? (composite.width > composite.height ? "landscape" : "portrait");
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const pageHeight = orientation === "landscape" ? 210 : 297;
  addCanvasToPdf(pdf, composite, 8, 10, pageWidth - 16, pageHeight - 20);
  pdf.save(safeFilename(options.filename ?? `بسلاسة-الشريحة-${new Date().toISOString().slice(0, 10)}`));
}

/** Captures a normal DOM report as a multi-page PDF. */
export async function exportElementToPdf(element: HTMLElement, options: PdfExportOptions): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.min(Math.max(options.scale ?? 2, 1), 3),
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDocument) => {
      const fallbackStyle = clonedDocument.createElement("style");
      fallbackStyle.textContent = `
        *, *::before, *::after { box-shadow: none !important; }
        body { background-color: #ffffff !important; }
      `;
      clonedDocument.head.appendChild(fallbackStyle);
      clonedDocument.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
        for (const property of ["color", "background-color", "border-color", "box-shadow", "text-shadow"]) {
          const value = node.style.getPropertyValue(property);
          if (/oklch?\(/i.test(value)) node.style.setProperty(property, property === "background-color" ? "rgb(255,255,255)" : "rgb(15,23,42)");
        }
      });
    },
  });
  const orientation = options.orientation ?? (canvas.width > canvas.height ? "landscape" : "portrait");
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const pageHeight = orientation === "landscape" ? 210 : 297;
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * contentWidth) / Math.max(canvas.width, 1);
  const usableHeight = pageHeight - margin * 2;
  let offset = 0;
  let page = 0;
  while (offset < imageHeight || page === 0) {
    if (page > 0) pdf.addPage("a4", orientation);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin - offset, contentWidth, imageHeight, undefined, "FAST");
    offset += usableHeight;
    page += 1;
  }
  pdf.save(safeFilename(options.filename));
}

export async function exportReportCardToPdf(input: {
  filename: string;
  title: string;
  subtitle?: string;
  sections: Array<{ heading: string; rows: Array<[string, string]> }>;
}): Promise<void> {
  const body: string[] = [];
  for (const section of input.sections) {
    body.push(section.heading);
    for (const [label, value] of section.rows) body.push(`${label}: ${value}`);
  }
  const canvas = await renderArabicCard(input.title, input.subtitle ?? "", body);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const margin = 10;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * contentWidth) / Math.max(canvas.width, 1);
  const usableHeight = pageHeight - margin * 2;
  let offset = 0;
  let page = 0;
  const image = canvas.toDataURL("image/png");
  while (offset < imageHeight || page === 0) {
    if (page > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(image, "PNG", margin, margin - offset, contentWidth, imageHeight, undefined, "FAST");
    offset += usableHeight;
    page += 1;
  }
  pdf.save(safeFilename(input.filename));
}
