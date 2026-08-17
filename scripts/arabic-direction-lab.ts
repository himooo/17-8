import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import ArabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();
const input = "تقرير ولي الأمر — منصة بسلاسة | ملخص الأداء | واجب Moodle";
const variants = [
  ["raw", input],
  ["reshaped", ArabicReshaper.convertArabic(input)],
  ["bidi-only", bidi.getReorderedString(input, bidi.getEmbeddingLevels(input, "rtl"))],
  ["reshaped+bidi", bidi.getReorderedString(ArabicReshaper.convertArabic(input), bidi.getEmbeddingLevels(ArabicReshaper.convertArabic(input), "rtl"))],
  ["reverse-reshaped+bidi", [...bidi.getReorderedString(ArabicReshaper.convertArabic(input), bidi.getEmbeddingLevels(ArabicReshaper.convertArabic(input), "rtl"))].reverse().join("")],
] as const;
const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const bytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", "Amiri-Regular.ttf"));
const font = await pdf.embedFont(bytes, { subset: false });
const page = pdf.addPage([595, 842]);
let y = 780;
for (const [label, text] of variants) {
  page.drawText(label, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
  page.drawText(text, { x: 150, y, size: 16, font, color: rgb(0, 0, 0) });
  y -= 42;
}
await fs.writeFile("/tmp/arabic-direction-lab.pdf", await pdf.save());
console.log("/tmp/arabic-direction-lab.pdf");
