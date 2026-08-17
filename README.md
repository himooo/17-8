# بسلاسة (Bisalasa)

منصة تعليمية تفاعلية — غرفة عمليات المدرس أثناء الحصة: شرائح، سبورة ذكية، ألعاب، مكافآت، تقارير، AI، Moodle وTelegram.

## التشغيل السريع

```bash
pnpm install          # أو npm install
npm run db:generate   # توليد عميل Prisma
npm run build         # مزامنة المخطط + بناء إنتاجي standalone
npm run start         # تشغيل الإنتاج على المنفذ 3000
# أو للتطوير:
npm run dev
```

المتطلبات: Node 20+ وpnpm 10 (يعمل npm أيضاً). قاعدة البيانات: SQLite في `data/custom.db` تُنشأ تلقائياً من `.env` — لا تحتاج ضبط `DATABASE_URL` يدوياً.

## خريطة المشروع

| المسار | الوصف |
|---|---|
| `src/` | كود Next.js (App Router) — الصفحات وواجهات API والمكونات والمنطق |
| `prisma/schema.prisma` | مخطط قاعدة البيانات (73 نموذجاً) |
| `public/slides/` | دروس HTML + وثائق الشرائح (تُخدم للعميل) |
| `scripts/` | اختبارات smoke/E2E وأدوات البناء والتدقيق |
| `docs/active/` | **الوثائق الحالية المعتمدة — ابدأ من `DOCUMENTATION-INDEX-AR.md`** |
| `docs/historical/` | سجلات جولات تدقيق سابقة (للتحقيق التاريخي فقط) |
| `data/` | قاعدة SQLite والأسرار المشتقة (لا تُشحن) |
| `backups/` | أرشيفات مصدر سابقة |
| `demo-import-pack-final/` | حزمة بيانات تجريبية للاستيراد |

## الاختبارات

```bash
npm run lint                            # ESLint
node_modules/.bin/tsc --noEmit          # TypeScript
npm run test:math                       # وغيرها: test:fairness، test:curriculum-factory، test:moodle:* …
```

قائمة كاملة بأوامر الاختبار في `package.json` و`docs/active/DOCUMENTATION-INDEX-AR.md`.
