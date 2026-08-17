# 📋 Slide Manifest Schema - العقد بين الـ Shell والشرائح

# مخطط بيانات الشرائح في بسلاسة

**آخر تحديث:** 16 أغسطس 2026 (جولة الإصلاحات الأمنية وقاعدة البيانات)

> هذا الملف هو "العقد" الذي يربط الإطار بأي شريحة مستوردة.
> أي شريحة HTML يجب أن تحتوي على `<script type="application/json" id="slide-manifest">` بالشكل التالي.

## 🎯 المخطط الكامل (Full Schema)

```json
{
  "lessonId": "string",
  "title": "string",
  "subtitle": "string (اختياري)",
  "totalSteps": "number",
  "currentStep": "number (الابتدائي عادة 1)",
  "aspectRatio": "16:9 | 9:16 | 4:3 | 1:1",
  "targetAge": "primary-lower | primary-upper | preparatory",
  "steps": [
    {
      "step": "number (1-indexed)",
      "title": "string (اختياري - عنوان مختصر)",
      "type": "content | question | celebration | transition",
      "script": "string | string[] (السكريبت للمدرس - يقسم لجمل ملوّنة)",
      "notes": "string (ملاحظات تفصيلية للمدرس)",
      "question": {
        "text": "string",
        "correctAnswer": "string | number",
        "options": ["string", "string"],
        "rewardPoints": "number"
      },
      "sound": {
        "onEnter": "string (اختياري)",
        "onSuccess": "string",
        "onError": "string"
      },
      "effect": "confetti | flash-red | flash-green | none",
      "autoSlideMs": "number (0 = يدوي)"
    }
  ],
  "assets": [
    {
      "id": "string (مثل: img_01_05_02)",
      "description": "string (وصف الصورة المطلوبة)",
      "type": "geometric-figure | illustration | photo | chart | icon",
      "status": "placeholder | final"
    }
  ]
}
```

## 🔌 بروتوكول postMessage

### الرسائل من Shell → الشريحة (iframe)

| type | الحقول | الوصف |
|------|--------|-------|
| `GOTO_STEP` | `step: number` | انتقل للخطوة رقم N |
| `NEXT` | — | الخطوة التالية |
| `PREV` | — | الخطوة السابقة |
| `REQUEST_MANIFEST` | — | اطلب الـ Manifest |
| `REQUEST_CURRENT_STEP` | — | اطلب الخطوة الحالية |

### الرسائل من الشريحة → Shell

| type | الحقول | الوصف |
|------|--------|-------|
| `MANIFEST` | `payload: SlideManifest` | الـ Manifest الكامل |
| `STEP_CHANGED` | `step, totalSteps` | تغيرت الخطوة الحالية |
| `READY` | — | الشريحة جاهزة |
| `ERROR` | `message: string` | خطأ |

## 📝 القالب الجاهز للنسخ (HTML Boilerplate)

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>عنوان الدرس</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    /* أنماطك الخاصة */
  </style>
</head>
<body>
  <!-- محتوى الشريحة -->
  <div id="slide-container">
    <div class="step-content" data-step="1">...</div>
    <div class="step-content hidden" data-step="2">...</div>
    <!-- ... -->
  </div>

  <!-- ============ MANIFEST ============ -->
  <script type="application/json" id="slide-manifest">
  {
    "lessonId": "lesson-XX",
    "title": "عنوان الدرس",
    "totalSteps": 5,
    "currentStep": 1,
    "aspectRatio": "16:9",
    "targetAge": "preparatory",
    "steps": [
      {
        "step": 1,
        "title": "عنوان الخطوة",
        "type": "content",
        "script": "السكريبت هنا. كل جملة تنتهي بنقطة هتظهر بلون مختلف.",
        "notes": "ملاحظات المدرس التفصيلية.",
        "autoSlideMs": 8000
      }
    ],
    "assets": []
  }
  </script>

  <!-- ============ CONTROLLER ============ -->
  <script>
    (function() {
      let currentStep = 1;
      const totalSteps = 5; // حدّث هذا الرقم

      function getManifest() {
        const el = document.getElementById('slide-manifest');
        if (!el) return null;
        try { return JSON.parse(el.textContent); } catch { return null; }
      }

      function showStep(step) {
        currentStep = step;
        document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
        const target = document.querySelector(`.step-content[data-step="${step}"]`);
        if (target) target.classList.remove('hidden');
        notifyShell({ type: 'STEP_CHANGED', step, totalSteps });
      }

      function notifyShell(msg) {
        window.parent.postMessage(msg, '*');
      }

      window.addEventListener('message', function(event) {
        const data = event.data;
        if (!data || !data.type) return;
        switch (data.type) {
          case 'GOTO_STEP': showStep(data.step); break;
          case 'NEXT': if (currentStep < totalSteps) showStep(currentStep + 1); break;
          case 'PREV': if (currentStep > 1) showStep(currentStep - 1); break;
          case 'REQUEST_MANIFEST':
            const m = getManifest();
            if (m) { m.currentStep = currentStep; notifyShell({ type: 'MANIFEST', payload: m }); }
            break;
        }
      });

      window.addEventListener('load', function() {
        notifyShell({ type: 'READY' });
        const m = getManifest();
        if (m) { m.currentStep = currentStep; notifyShell({ type: 'MANIFEST', payload: m }); }
      });
    })();
  </script>
</body>
</html>
```

## 🎨 قواعد مهمة

1. **dir="rtl"** على `<html>` إلزامي
2. **font-family: 'Cairo'** للنص العربي
3. **data-step="N"** على كل `.step-content` (N = رقم الخطوة)
4. **id="slide-manifest"** على script tag الـ JSON
5. **window.parent.postMessage** للتواصل مع الـ Shell
6. **manifest.currentStep = 1** عند التحميل الأولي
7. الألوان: أزرق `#0142A0`، أحمر `#DA151C`، خلفية `#FFFFFF`
8. ارتفاع الخط للعرض: لا يقل عن `28px` للمحتوى و `40px` للعناوين

## 🧪 الاختبار

للتأكد من عمل شريحتك:
1. استوردها في الـ Shell (زر "استيراد شرائح")
2. ستظهر في لوحة المنهج
3. اضغط عليها لتفعيلها
4. تحقق من ظهور:
   - عنوان الدرس في الشريط العلوي
   - السكريبت في التليبرومبتر (بألوان متبادلة)
   - النوتس في لوحة Notes
   - الأصول في لوحة Assets
   - الخطوات في القائمة الشجرية
5. جرّب الأسهم للتتنقل بين الخطوات
6. جرّب الاختصارات: P, L, E, R, C, M
