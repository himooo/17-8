# ═══════════════════════════════════════════════════════════════
#  عقد الفايب كودينج - شرائح منصة "بسلاسة"
#  VIBE CODING CONTRACT FOR BISALASA SLIDES
#  النسخة 9.0 - وثيقة إلزامية لأي AI Model
#  الحالة المرجعية الحالية: 16 أغسطس 2026 (جولة الإصلاحات الأمنية وقاعدة البيانات)
# ═══════════════════════════════════════════════════════════════

> ## ⚠️ تحذير صارم
> هذا الملف هو **العقد الإلزامي** بينك (الـ AI Model) وبين منصة "بسلاسة".
> اقرأه **كاملاً** قبل كتابة أي سطر كود.
> أي مخالفة لأي بند ستسبب **فشل الشريحة** في العمل أو سلوك غير متوقع.
> لا تترك أي شيء لتخمينك. كل التفاصيل هنا محددة بدقة.

---

## 📋 جدول المحتويات

1. [فهم المنصة (Architecture)](#1-فهم-المنصة)
2. [القواعد الذهبية (Golden Rules)](#2-القواعد-الذهبية)
3. [بروتوكول التواصل (postMessage)](#3-بروتوكول-التواصل)
4. [مخطط البيانات (Manifest Schema)](#4-مخطط-البيانات)
5. [أنواع الشرائح المدعومة](#5-أنواع-الشرائح)
6. [بنية ملف HTML الإلزامية](#6-بنية-ملف-html)
7. [كود الـ Controller الإلزامي](#7-كود-الـ-controller)
8. [النمط 1: خطوات مسطحة](#8-النمط-1-خطوات-مسطحة)
9. [النمط 2: أفكار متداخلة](#9-النمط-2-أفكار-متداخلة)
10. [النمط 3: شرائح React](#10-النمط-3-شرائح-react)
11. [قواعد السكريبت](#11-قواعد-السكريبت)
12. [قواعد الأسئلة التفاعلية](#12-قواعد-الأسئلة)
13. [الأصول (Assets)](#13-الأصول)
14. [الأصوات والتأثيرات](#14-الأصوات-والتأثيرات)
15. [ما يجب فعله (DO)](#15-ما-يجب-فعله)
16. [ما يجب الامتناع عنه (DON'T)](#16-ما-يجب-الامتناع-عنه)
17. [أمثلة كاملة](#17-أمثلة-كاملة)
18. [قائمة التحقق النهائية](#18-قائمة-التحقق)

---

## 1. فهم المنصة

### المعمارية الأساسية

منصة "بسلاسة" تعمل كـ **Host Shell** (مضيف). هي تطبيق React/Next.js يعرض شرائحك داخل `iframe` معزول. التواصل بين الـ Shell والشريحة يتم **حصرياً** عبر `window.postMessage`.

```
┌─────────────────────────────────────────────────┐
│  بسلاسة (Host Shell) - React/Next.js            │
│  ┌───────────────────────────────────────────┐  │
│  │  TopStatusBar (28px)                      │  │
│  ├───────────────────────────────────────────┤  │
│  │  DraggableTeleprompter (يعرض script)      │  │
│  ├───────────────────────────────────────────┤  │
│  │                                           │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  iframe (شريحتك هنا)                │  │  │
│  │  │  + SmartWhiteboard overlay          │  │  │
│  │  │                                     │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  ├───────────────────────────────────────────┤  │
│  │  SideRail (52px ثابت يمين)                │  │
│  ├───────────────────────────────────────────┤  │
│  │  BottomControlBar (48px)                  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### ما يتحكم فيه الـ Shell (لا تتدخل فيه):
- التليبرومبتر (يعرض `script` من الـ Manifest)
- لوحة النوتس (يعرض `notes` من الـ Manifest)
- لوحة الأصول (يعرض `assets` من الـ Manifest)
- السبورة الذكية (قلم، ليزر، أشكال فوق شريحتك)
- إدارة الطلاب والنقاط والشارات
- التنقل بين الخطوات (الأسهم + الاختصارات)
- الأصوات والكونفيتي

### ما تتحكم فيه أنت (الشريحة):
- المحتوى البصري (HTML/CSS/JS)
- الأنيميشن والتفاعلات داخل الشريحة
- الاستجابة لأوامر التنقل (GOTO_STEP, NEXT, PREV)
- إرسال الـ Manifest عند التحميل

---

## 2. القواعد الذهبية

### 🥇 القاعدة #1: الـ iframe معزول
شريحتك تعمل في `iframe` بـ sandbox. لا يمكنك الوصول لـ DOM الـ Shell مباشرة. كل تواصل عبر `postMessage` فقط.

### 🥈 القاعدة #2: الـ Manifest إلزامي
بدون `<script type="application/json" id="slide-manifest">`، الـ Shell لن يعرف أي شيء عن شريحتك (لا خطوات، لا سكريبت، لا نوتس).

### 🥉 القاعدة #3: الـ Controller إلزامي
بدون كود الـ Controller (الذي يستمع لرسائل postMessage ويرسل STEP_CHANGED)، التنقل لن يعمل.

### 🏅 القاعدة #4: RTL إلزامي
`<html lang="ar" dir="rtl">` في كل شرائح HTML.

### 🏅 القاعدة #5: خط Cairo إلزامي
حمّل خط Cairo من Google Fonts في كل شريحة.

---

## 3. بروتوكول التواصل

### الرسائل من Shell → الشريحة (أوامر)

| type | الحقول | متى تُرسل | ما يجب فعله |
|------|--------|-----------|-------------|
| `GOTO_STEP` | `step: number, ideaId?: string` | عند الضغط على خطوة أو السهم | اعرض الخطوة N (من الفكرة المحددة إن وجدت) |
| `NEXT` | — | السهم الأيمن / Space | اعرض الخطوة التالية (أو الفكرة التالية) |
| `PREV` | — | السهم الأيسر | اعرض الخطوة السابقة (أو الفكرة السابقة) |
| `GOTO_IDEA` | `ideaId: string, step?: number` | عند الضغط على فكرة في القائمة | اعرض الفكرة المحددة |
| `REQUEST_MANIFEST` | — | عند تحميل الشريحة | أرسل الـ Manifest كاملاً |
| `REQUEST_CURRENT_STEP` | — | نادر | أرسل STEP_CHANGED |
| `PLAY_SOUND` | `sound: "success"\|"error"\|"celebrate"\|"click"` | نادر | شغّل الصوت |

### الرسائل من الشريحة → Shell (استجابات)

| type | الحقول | متى تُرسل |
|------|--------|-----------|
| `MANIFEST` | `payload: SlideManifest` | عند التحميل أو عند الطلب |
| `STEP_CHANGED` | `step: number, totalSteps: number, ideaId?: string` | **دائماً** بعد تغيير الخطوة |
| `IDEA_CHANGED` | `ideaId: string, step: number, title?: string` | عند تغيير الفكرة |
| `READY` | — | عند انتهاء تحميل DOM |
| `REQUEST_SOUND` | `sound: "success"\|"error"\|"celebrate"\|"click"` | عندما تطلب صوتاً من الـ Shell |
| `ERROR` | `message: string` | عند حدوث خطأ |

### ⚠️ قواعد التواصل:
1. **دائماً** أرسل `READY` عند التحميل
2. **دائماً** أرسل `MANIFEST` بعد `READY` مباشرة
3. **دائماً** أرسل `STEP_CHANGED` بعد كل `showStep()`
4. في وضع الأفكار، **دائماً** أرسل `ideaId` في `STEP_CHANGED`
5. استخدم `window.parent.postMessage(msg, '*')` دائماً

---

## 4. مخطط البيانات

```typescript
interface SlideManifest {
  // ===== بيانات الدرس =====
  lessonId: string;                    // معرّف فريد: "lesson-XX-YY"
  title: string;                       // عنوان الدرس (يظهر في القائمة والشريط العلوي)
  subtitle?: string;                   // وصف مختصر
  contentType?: "html" | "react";      // نوع المحتوى
  totalSteps?: number;                 // إجمالي الخطوات (يُحسب تلقائياً من ideas)
  currentStep: number;                 // الخطوة الحالية (1 عند البدء)
  currentIdeaId?: string;              // الفكرة النشطة (للأفكار المتداخلة)
  aspectRatio?: "16:9" | "9:16" | "4:3" | "1:1";
  targetAge?: "primary-lower" | "primary-upper" | "preparatory";

  // ===== نمط 1: خطوات مسطحة =====
  steps?: SlideStep[];

  // ===== نمط 2: أفكار متداخلة =====
  ideas?: SlideIdea[];

  // ===== الأصول =====
  assets?: SlideAsset[];
}

interface SlideIdea {
  id: string;                          // "idea-1", "idea-2", etc.
  title: string;                       // عنوان الفكرة (يظهر في القائمة الشجرية)
  description?: string;
  color?: "blue" | "red" | "green" | "amber" | "purple" | "cyan";
  steps: SlideStep[];                  // خطوات هذه الفكرة فقط
}

interface SlideStep {
  step: number;                        // 1-indexed (داخل الفكرة)
  title?: string;                      // عنوان مختصر (يظهر في القائمة)
  type?: "content" | "question" | "celebration" | "transition";

  script?: string | string[];          // السكريبت (يُقسم لجمل بألوان متبادلة)
  notes?: string;                      // ملاحظات تفصيلية للمدرس

  question?: {
    text?: string;
    correctAnswer?: string | number;
    options?: string[];
    rewardPoints?: number;
  };

  sound?: {
    onEnter?: string;
    onSuccess?: string;
    onError?: string;
  };

  effect?: "confetti" | "flash-red" | "flash-green" | "none";
  autoSlideMs?: number;                // 0 = يدوي فقط
}

interface SlideAsset {
  id: string;                          // "img_01_05_02"
  description: string;                 // وصف واضح للصورة المطلوبة
  type: "geometric-figure" | "illustration" | "photo" | "chart" | "icon";
  status: "placeholder" | "final";
}
```

---

## 5. أنواع الشرائح

### نمط 1: خطوات مسطحة (Flat Steps)
للدروس البسيطة (سلسلة خطوات متتالية):
- استخدم `steps: SlideStep[]`
- كل خطوة لها `step` من 1 إلى N
- لا تستخدم `ideas`

### نمط 2: أفكار متداخلة (Nested Ideas)
للدروس المعقدة (عدة مفاهيم، كل مفهوم له خطواته):
- استخدم `ideas: SlideIdea[]`
- كل فكرة لها `id`, `title`, `color`, `steps[]`
- في HTML: كل `.step-content` يحتاج `data-idea="idea-1"` و `data-step="1"`
- التنقل التلقائي ينتقل للفكرة التالية عند انتهاء الحالية

### نمط 3: شرائح React
للشرائح المبنية بـ React:
- ابنِ React كـ static build
- ادمج (inline) الـ CSS والـ JS داخل `index.html`
- أضف الـ Manifest script tag
- أضف كود الـ Controller

---

## 6. بنية ملف HTML

كل ملف HTML يجب أن يتبع هذه البنية **بالضبط**:

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>عنوان الدرس</title>
  <!-- خط Cairo إلزامي -->
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    /* أنماطك هنا */
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
    body { width: 100vw; height: 100vh; overflow: hidden; background: #fff; color: #1A1A1A; }
    .slide-container { width: 100%; height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 40px; position: relative; }
    /* أخفِ كل الخطوات افتراضياً */
    .step-content { display: none; }
    .step-content.active { display: flex; flex-direction: column; align-items: center;
      gap: 1.5rem; animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="slide-container">
    <!-- الخطوات هنا -->
    <div class="step-content active" data-step="1">...</div>
    <div class="step-content" data-step="2">...</div>
  </div>

  <!-- الـ Manifest (إلزامي) -->
  <script type="application/json" id="slide-manifest">
  { /* JSON هنا */ }
  </script>

  <!-- الـ Controller (إلزامي) -->
  <script>
    /* كود التحكم هنا */
  </script>
</body>
</html>
```

### ⚠️ قواعد البنية:
1. الخطوة الأولى لها `class="step-content active"`
2. باقي الخطوات لها `class="step-content"` (بدون active)
3. كل خطوة لها `data-step="N"` (N = رقم الخطوة)
4. في وضع الأفكار، أضف `data-idea="idea-1"` أيضاً
5. الـ Manifest script tag يجب أن يكون في `<body>` وليس `<head>`
6. الـ Controller يجب أن يكون **آخر** عنصر في `<body>`

---

## 7. كود الـ Controller

### النمط 1: خطوات مسطحة

```javascript
(function() {
  let currentStep = 1;

  function getManifest() {
    const el = document.getElementById('slide-manifest');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  }

  function getTotalSteps() {
    const m = getManifest();
    return m ? (m.totalSteps || (m.steps ? m.steps.length : 1)) : 1;
  }

  function showStep(step) {
    currentStep = step;
    // إخفاء كل الخطوات
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    // إظهار الخطوة الحالية
    const target = document.querySelector(`.step-content[data-step="${step}"]`);
    if (target) target.classList.add('active');
    // إبلاغ الـ Shell
    notifyShell({ type: 'STEP_CHANGED', step: step, totalSteps: getTotalSteps() });
  }

  function notifyShell(msg) {
    window.parent.postMessage(msg, '*');
  }

  // الاستماع لأوامر الـ Shell
  window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.type) return;
    const total = getTotalSteps();
    switch (data.type) {
      case 'GOTO_STEP':
        showStep(data.step);
        break;
      case 'NEXT':
        if (currentStep < total) showStep(currentStep + 1);
        break;
      case 'PREV':
        if (currentStep > 1) showStep(currentStep - 1);
        break;
      case 'REQUEST_MANIFEST':
        const m = getManifest();
        if (m) { m.currentStep = currentStep; notifyShell({ type: 'MANIFEST', payload: m }); }
        break;
    }
  });

  // عند التحميل
  window.addEventListener('load', function() {
    notifyShell({ type: 'READY' });
    const m = getManifest();
    if (m) { m.currentStep = currentStep; notifyShell({ type: 'MANIFEST', payload: m }); }
    showStep(1);
  });
})();
```

### النمط 2: أفكار متداخلة

```javascript
(function() {
  let currentStep = 1;
  let currentIdeaId = 'idea-1';

  function getManifest() {
    const el = document.getElementById('slide-manifest');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  }

  function getCurrentIdea() {
    const m = getManifest();
    if (!m || !m.ideas) return null;
    return m.ideas.find(i => i.id === currentIdeaId) || m.ideas[0];
  }

  function showStep(step, ideaId) {
    if (ideaId) currentIdeaId = ideaId;
    currentStep = step;
    // إخفاء كل الخطوات
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    // إظهار الخطوة الحالية (مع data-idea)
    const selector = ideaId
      ? `.step-content[data-idea="${ideaId}"][data-step="${step}"]`
      : `.step-content[data-step="${step}"]`;
    const target = document.querySelector(selector);
    if (target) target.classList.add('active');
    // إبلاغ الـ Shell
    const idea = getCurrentIdea();
    const totalSteps = idea ? idea.steps.length : 1;
    notifyShell({
      type: 'STEP_CHANGED',
      step: step,
      totalSteps: totalSteps,
      ideaId: currentIdeaId
    });
  }

  function notifyShell(msg) { window.parent.postMessage(msg, '*'); }

  function nextStep() {
    const m = getManifest();
    const idea = getCurrentIdea();
    if (!idea || !m) return;
    if (currentStep < idea.steps.length) {
      showStep(currentStep + 1, currentIdeaId);
    } else {
      // الانتقال للفكرة التالية
      const idx = m.ideas.findIndex(i => i.id === currentIdeaId);
      if (idx < m.ideas.length - 1) {
        showStep(1, m.ideas[idx + 1].id);
      }
    }
  }

  function prevStep() {
    const m = getManifest();
    if (currentStep > 1) {
      showStep(currentStep - 1, currentIdeaId);
    } else {
      // الرجوع للفكرة السابقة
      const idx = m.ideas.findIndex(i => i.id === currentIdeaId);
      if (idx > 0) {
        const prevIdea = m.ideas[idx - 1];
        showStep(prevIdea.steps.length, prevIdea.id);
      }
    }
  }

  window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.type) return;
    switch (data.type) {
      case 'GOTO_STEP':
        showStep(data.step, data.ideaId);
        break;
      case 'NEXT':
        nextStep();
        break;
      case 'PREV':
        prevStep();
        break;
      case 'GOTO_IDEA':
        showStep(data.step || 1, data.ideaId);
        break;
      case 'REQUEST_MANIFEST':
        const m = getManifest();
        if (m) {
          m.currentStep = currentStep;
          m.currentIdeaId = currentIdeaId;
          notifyShell({ type: 'MANIFEST', payload: m });
        }
        break;
    }
  });

  // معالج النقر على الاختيارات (للأسئلة)
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('option')) {
      const isCorrect = e.target.dataset.correct === 'true';
      document.querySelectorAll('.option').forEach(opt => opt.classList.remove('correct', 'wrong'));
      if (isCorrect) {
        e.target.classList.add('correct');
        notifyShell({ type: 'REQUEST_SOUND', sound: 'success' });
      } else {
        e.target.classList.add('wrong');
        notifyShell({ type: 'REQUEST_SOUND', sound: 'error' });
      }
    }
  });

  window.addEventListener('load', function() {
    notifyShell({ type: 'READY' });
    const m = getManifest();
    if (m) {
      m.currentStep = currentStep;
      m.currentIdeaId = currentIdeaId;
      notifyShell({ type: 'MANIFEST', payload: m });
    }
    showStep(1, currentIdeaId);
  });
})();
```

---

## 8. النمط 1: خطوات مسطحة

### مثال HTML:
```html
<div class="slide-container">
  <div class="step-content active" data-step="1">
    <h1 class="title">مقدمة</h1>
    <p class="content">محتوى الخطوة الأولى</p>
  </div>
  <div class="step-content" data-step="2">
    <h1 class="title">شرح</h1>
    <p class="content">محتوى الخطوة الثانية</p>
  </div>
  <div class="step-content" data-step="3">
    <h1 class="title">سؤال</h1>
    <div class="options-grid">
      <div class="option" data-correct="false">خيار 1</div>
      <div class="option" data-correct="true">خيار 2</div>
    </div>
  </div>
</div>
```

### مثال Manifest:
```json
{
  "lessonId": "lesson-01",
  "title": "عنوان الدرس",
  "totalSteps": 3,
  "currentStep": 1,
  "aspectRatio": "16:9",
  "targetAge": "preparatory",
  "steps": [
    {
      "step": 1,
      "title": "مقدمة",
      "type": "content",
      "script": "أهلاً يا شباب. النهاردة هنتعلم حاجة جديدة.",
      "notes": "ابدأ بسؤال الطلاب عن معرفتهم السابقة.",
      "autoSlideMs": 8000
    },
    {
      "step": 2,
      "title": "شرح",
      "type": "content",
      "script": "المفهوم الأساسي هو كذا وكذا.",
      "notes": "ارسم على السبورة لتوضيح.",
      "autoSlideMs": 10000
    },
    {
      "step": 3,
      "title": "سؤال",
      "type": "question",
      "script": "السؤال: كام يساوي 2+2؟",
      "notes": "الإجابة: 4. استخدم R لاختيار طالب.",
      "question": {
        "text": "كام يساوي 2+2؟",
        "correctAnswer": "4",
        "options": ["3", "4", "5", "6"],
        "rewardPoints": 3
      },
      "effect": "confetti",
      "autoSlideMs": 0
    }
  ],
  "assets": []
}
```

---

## 9. النمط 2: أفكار متداخلة

### مثال HTML:
```html
<div class="slide-container">
  <!-- الفكرة 1 -->
  <div class="step-content active" data-step="1" data-idea="idea-1">...</div>
  <div class="step-content" data-step="2" data-idea="idea-1">...</div>
  <!-- الفكرة 2 -->
  <div class="step-content" data-step="1" data-idea="idea-2">...</div>
  <div class="step-content" data-step="2" data-idea="idea-2">...</div>
</div>
```

### مثال Manifest:
```json
{
  "lessonId": "lesson-fractions",
  "title": "الكسور الكاملة",
  "currentStep": 1,
  "currentIdeaId": "idea-1",
  "aspectRatio": "16:9",
  "ideas": [
    {
      "id": "idea-1",
      "title": "تعريف الكسر",
      "color": "blue",
      "steps": [
        { "step": 1, "title": "تعريف", "type": "content", "script": "...", "notes": "..." },
        { "step": 2, "title": "مثال", "type": "content", "script": "...", "notes": "..." }
      ]
    },
    {
      "id": "idea-2",
      "title": "جمع الكسور",
      "color": "green",
      "steps": [
        { "step": 1, "title": "قاعدة الجمع", "type": "content", "script": "...", "notes": "..." },
        { "step": 2, "title": "سؤال", "type": "question", "script": "...", "question": {...}, "effect": "confetti" }
      ]
    }
  ],
  "assets": []
}
```

---

## 10. النمط 3: شرائح React

### الطريقة: React Build → Inline HTML

1. ابنِ تطبيق React كـ static build
2. افتح `index.html` الناتج
3. استبدل كل `<link rel="stylesheet" href="...">` بـ `<style>...محتوى CSS...</style>`
4. استبدل كل `<script src="...">` بـ `<script>...محتوى JS...</script>`
5. أضف الـ Manifest script tag
6. أضف كود الـ Controller

### مثال React Component:

```jsx
import { useEffect, useState } from 'react';

function App() {
  const [currentStep, setCurrentStep] = useState(1);

  const manifest = {
    lessonId: "react-lesson-01",
    title: "عنوان الدرس",
    currentStep: 1,
    steps: [...],
    assets: []
  };

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      switch (data.type) {
        case 'GOTO_STEP':
          setCurrentStep(data.step);
          break;
        case 'NEXT':
          setCurrentStep(s => Math.min(s + 1, manifest.steps.length));
          break;
        case 'PREV':
          setCurrentStep(s => Math.max(s - 1, 1));
          break;
        case 'REQUEST_MANIFEST':
          window.parent.postMessage({
            type: 'MANIFEST',
            payload: { ...manifest, currentStep }
          }, '*');
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentStep]);

  // إرسال READY و MANIFEST عند التحميل
  useEffect(() => {
    window.parent.postMessage({ type: 'READY' }, '*');
    window.parent.postMessage({
      type: 'MANIFEST',
      payload: { ...manifest, currentStep }
    }, '*');
  }, []);

  // إرسال STEP_CHANGED عند تغيير الخطوة
  useEffect(() => {
    window.parent.postMessage({
      type: 'STEP_CHANGED',
      step: currentStep,
      totalSteps: manifest.steps.length
    }, '*');
  }, [currentStep]);

  return (
    <div className="slide-container">
      {/* محتوى الشريحة بناءً على currentStep */}
    </div>
  );
}
```

---

## 11. قواعد السكريبت

السكريبت (`script`) يظهر في التليبرومبتر. يُقسم تلقائياً لجمل بألوان متبادلة.

### التقسيم التلقائي:
يُقسم على علامات الترقيم: `.` `،` `؛` `!` `؟` `\n`

### الألوان المتبادلة:
- الجملة 1: **أزرق فاتح** (font-semibold)
- الجملة 2: **أبيض** (foreground)
- الجملة 3: أزرق فاتح
- الجملة 4: أبيض
- الجملة 5: **أصفر/أحمر** (font-bold) — كل 5 جمل تأكيد

### مثال:
```json
"script": "أهلاً يا شباب. النهاردة هنتعلم حاجة جديدة. خليكم فاتحين بالكم. ده موضوع مهم جداً. ركزوا كويس."
```
سيظهر:
[أزرق] أهلاً يا شباب. [أبيض] النهاردة هنتعلم حاجة جديدة. [أزرق] خليكم فاتحين بالكم. [أبيض] ده موضوع مهم جداً. [أحمر] ركزوا كويس.

### يمكن تمرير مصفوفة جمل جاهزة:
```json
"script": ["الجملة الأولى", "الجملة الثانية", "الجملة الثالثة"]
```

### ⚠️ قواعد السكريبت:
1. اكتب السكريبت **كما يقوله المدرس** (لغة شفهية)
2. استخدم علامات ترقيم واضحة لتقسيم الجمل
3. لا تجعل الجملة الواحدة طويلة جداً
4. كل جملة يجب أن تكون فكرة واحدة مكتملة

---

## 12. قواعد الأسئلة

### بنية السؤال:
```json
{
  "step": 5,
  "title": "سؤال تفاعلي",
  "type": "question",
  "script": "السؤال: كام يساوي 2+2؟ فكروا كويس.",
  "notes": "الإجابة: 4. استخدم R لاختيار طالب.",
  "question": {
    "text": "كام يساوي 2+2؟",
    "correctAnswer": "4",
    "options": ["3", "4", "5", "6"],
    "rewardPoints": 3
  },
  "effect": "confetti",
  "autoSlideMs": 0
}
```

### في HTML:
```html
<div class="step-content" data-step="5">
  <h1>سؤال تفاعلي 🎯</h1>
  <p>كام يساوي 2+2؟</p>
  <div class="options-grid">
    <div class="option" data-correct="false">3</div>
    <div class="option" data-correct="true">4</div>
    <div class="option" data-correct="false">5</div>
    <div class="option" data-correct="false">6</div>
  </div>
</div>
```

### ⚠️ قواعد الأسئلة:
1. `autoSlideMs: 0` دائماً للأسئلة (لا تتقدم تلقائياً)
2. `effect: "confetti"` للاحتفال عند الإجابة الصحيحة
3. الإجابة الصحيحة لها `data-correct="true"` في HTML
4. الـ Controller يتعامل مع النقر على الاختيارات تلقائياً
5. `correctAnswer` يظهر للمدرس فقط في التليبرومبتر

---

## 13. الأصول

الأصول (Assets) تصف الصور الوهمية (Placeholders) التي يحتاجها الدرس.

```json
"assets": [
  {
    "id": "img_01_03_01",
    "description": "رسم بيتزا كاملة مقسمة 4 أجزاء متساوية",
    "type": "illustration",
    "status": "placeholder"
  }
]
```

### قواعد التسمية:
```
img_[lessonNumber]_[stepNumber]_[imageIndex].[ext]
```
مثال: `img_01_05_02.svg` = الدرس 1، السلايد 5، ثاني صورة.

### أنواع الأصول:
- `geometric-figure`: أشكال هندسية (مثلث، دائرة)
- `illustration`: رسومات توضيحية
- `photo`: صور فوتوغرافية
- `chart`: رسوم بيانية
- `icon`: أيقونات

---

## 14. الأصوات والتأثيرات

### طلب صوت من الـ Shell:
```javascript
window.parent.postMessage({ type: 'REQUEST_SOUND', sound: 'success' }, '*');
```

### الأصوات المتاحة:
- `success`: نغمة صاعدة لطيفة
- `error`: نغمتان هابطتان
- `celebrate`: احتفال كبير (5 نغمات)
- `click`: نقرة قصيرة

### التأثيرات (في الـ Manifest):
```json
"effect": "confetti"  // كونفيتي عند الدخول للخطوة
"effect": "flash-red"  // وميض أحمر
"effect": "flash-green"  // وميض أخضر
"effect": "none"  // لا تأثير (افتراضي)
```

---

## 15. ما يجب فعله (DO)

### ✅ DO: التصميم
- استخدم `<html lang="ar" dir="rtl">`
- حمّل خط Cairo من Google Fonts
- استخدم ألوان البراند: أزرق `#0142A0`، أحمر `#DA151C`
- حجم الخط ≥ 28px للمحتوى، ≥ 40px للعناوين
- `line-height` بين 1.5 و 1.8
- استخدم أرقام إنجليزية (0-9)

### ✅ DO: البنية
- كل خطوة في `<div class="step-content" data-step="N">`
- الخطوة الأولى لها `class="step-content active"`
- الـ Manifest في `<script type="application/json" id="slide-manifest">`
- الـ Controller في `<script>` آخر `<body>`

### ✅ DO: التواصل
- أرسل `READY` عند التحميل
- أرسل `MANIFEST` بعد `READY`
- أرسل `STEP_CHANGED` بعد كل `showStep()`
- استخدم `window.parent.postMessage(msg, '*')`

### ✅ DO: المحتوى
- اكتب السكريبت بلغة شفهية (كما يقولها المدرس)
- اكتب ملاحظات تفصيلية للمدرس في `notes`
- استخدم `autoSlideMs: 0` للأسئلة
- ضع `effect: "confetti"` للأسئلة والاحتفالات

### ✅ DO: الأنيميشن
- استخدم CSS animations بسيطة
- `fade-in` للدخول (0.5s)
- تجنب الأنيميشن المعقدة التي تستهلك الأداء

### ✅ DO: SVG
- استخدم SVG للأشكال الهندسية (بدل الصور)
- ادمج SVG inline في HTML
- استخدم `viewBox` للتحكم في الأبعاد

---

## 16. ما يجب الامتناع عنه (DON'T)

### ❌ DON'T: التصميم
- لا تستخدم `text-align: justify` (يكسر النص العربي)
- لا تستخدم خطوط غير Cairo
- لا تستخدم ألوان عشوائية (استخدم ألوان البراند)
- لا تجعل الخط أقل من 28px

### ❌ DON'T: البنية
- لا تضع الـ Manifest في `<head>`
- لا تنسَ `data-step` على كل `.step-content`
- لا تنسَ `class="active"` على الخطوة الأولى
- لا تكرر أرقام الخطوات

### ❌ DON'T: التواصل
- لا تستخدم `alert()` أو `confirm()` (تتعارض مع iframe)
- لا تستخدم `localStorage` (قد لا يعمل في sandbox)
- لا تستخدم `window.open()` (يُحظر في sandbox)
- لا تنسَ إرسال `STEP_CHANGED` بعد `showStep()`

### ❌ DON'T: الكود
- لا تستخدم `inline styles` أو `inline event handlers`
- لا تكتب كل المنطق في دالة واحدة ضخمة
- لا تكرر الكود (حوّله لدالة مشتركة)
- لا تستخدم مكتبات ضخمة بدون داعٍ

### ❌ DON'T: المحتوى
- لا تضع أكثر من فكرة واحدة في الخطوة الواحدة
- لا تجعل السكريبت طويلاً جداً (أقصى 3-4 جمل)
- لا تنسَ `notes` لأي خطوة (مهمة للمدرس)
- لا تستخدم `autoSlideMs` للأسئلة (استخدم 0)

### ❌ DON'T: الأنيميشن
- لا تستخدم أنيميشن أطول من 1 ثانية
- لا تشغل أنيميشن على أكثر من عنصر في نفس الوقت
- لا تستخدم `position: fixed` (يكسر الـ iframe)
- لا تستخدم `transform: scale` على الـ body (يتعارض مع الـ Shell)

---

## 17. أمثلة كاملة

### مثال 1: خطوة محتوى بسيطة

```html
<div class="step-content active" data-step="1">
  <h1 class="title">تعريف المثلث</h1>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <polygon points="100,20 180,180 20,180" fill="#3b82f6" stroke="#1d4ed8" stroke-width="4"/>
  </svg>
  <p class="content">المثلث شكل هندسي له 3 أضلاع و 3 زوايا</p>
</div>
```

```json
{
  "step": 1,
  "title": "تعريف المثلث",
  "type": "content",
  "script": "المثلث شكل هندسي مهم جداً. له 3 أضلاع و 3 زوايا. مجموع الزوايا دائماً 180 درجة.",
  "notes": "ارسم مثلثاً على السبورة باستخدام أداة الأشكال (S). اطلب من الطلاب عدّ الزوايا.",
  "autoSlideMs": 8000
}
```

### مثال 2: خطوة سؤال تفاعلي

```html
<div class="step-content" data-step="3">
  <h1 class="title">سؤال: مجموع الزوايا</h1>
  <p class="content">إذا كانت زاويتان 60° و 70°، فما الزاوية الثالثة؟</p>
  <div class="options-grid">
    <div class="option" data-correct="false">40°</div>
    <div class="option" data-correct="true">50°</div>
    <div class="option" data-correct="false">60°</div>
    <div class="option" data-correct="false">70°</div>
  </div>
</div>
```

```json
{
  "step": 3,
  "title": "سؤال: الزاوية الثالثة",
  "type": "question",
  "script": "السؤال: إذا كانت زاويتان 60 و 70 درجة، فما قياس الزاوية الثالثة؟ فكروا كويس قبل ما تجاوبوا.",
  "notes": "الإجابة: 50°. الحل: 180 - (60+70) = 50. استخدم R لاختيار طالب عشوائي.",
  "question": {
    "text": "زاويتان 60° و 70°، ما الزاوية الثالثة؟",
    "correctAnswer": "50°",
    "options": ["40°", "50°", "60°", "70°"],
    "rewardPoints": 3
  },
  "effect": "confetti",
  "autoSlideMs": 0
}
```

### مثال 3: خطوة احتفال

```html
<div class="step-content" data-step="6">
  <div style="font-size: 8rem;">🎉</div>
  <h1 class="title">أحسنتم يا أبطال!</h1>
  <p class="content">تعلمتم الدرس بنجاح</p>
</div>
```

```json
{
  "step": 6,
  "title": "اختتام الدرس",
  "type": "celebration",
  "script": "أحسنتم يا أبطال! تعلمتم الدرس بنجاح. شكراً ليكم على التركيز.",
  "notes": "وزع نقاط على الطلاب المشاركين. استخدم زر المكافأة الذهبية (+10) لأفضل طالب.",
  "effect": "confetti",
  "autoSlideMs": 5000
}
```

### مثال 4: فكرة متداخلة كاملة

```html
<!-- الفكرة 1: تعريف -->
<div class="step-content active" data-step="1" data-idea="idea-1">
  <h1>تعريف الكسر</h1>
  <p>الكسر هو جزء من كل</p>
</div>
<div class="step-content" data-step="2" data-idea="idea-1">
  <h1>مثال</h1>
  <p>1/4 = ربع</p>
</div>

<!-- الفكرة 2: جمع -->
<div class="step-content" data-step="1" data-idea="idea-2">
  <h1>جمع الكسور</h1>
  <p>نجمع البسط ونثبت المقام</p>
</div>
<div class="step-content" data-step="2" data-idea="idea-2">
  <h1>سؤال</h1>
  <div class="options-grid">
    <div class="option" data-correct="true">4/5</div>
    <div class="option" data-correct="false">4/10</div>
  </div>
</div>
```

```json
{
  "lessonId": "fractions-01",
  "title": "الكسور",
  "currentStep": 1,
  "currentIdeaId": "idea-1",
  "ideas": [
    {
      "id": "idea-1",
      "title": "تعريف الكسر",
      "color": "blue",
      "steps": [
        { "step": 1, "title": "تعريف", "type": "content", "script": "الكسر هو جزء من كل.", "notes": "..." },
        { "step": 2, "title": "مثال", "type": "content", "script": "مثال: ربع البيتزا.", "notes": "..." }
      ]
    },
    {
      "id": "idea-2",
      "title": "جمع الكسور",
      "color": "green",
      "steps": [
        { "step": 1, "title": "قاعدة الجمع", "type": "content", "script": "نجمع البسط ونثبت المقام.", "notes": "..." },
        { "step": 2, "title": "سؤال", "type": "question", "script": "2/5 + 2/5 = ؟", "question": {"text": "2/5 + 2/5 = ?", "correctAnswer": "4/5", "options": ["4/5","4/10","2/5","1/5"], "rewardPoints": 3}, "effect": "confetti", "autoSlideMs": 0 }
      ]
    }
  ],
  "assets": []
}
```

---

## 18. قائمة التحقق

قبل اعتبار الشريحة جاهزة، تحقق من:

### الهيكل
- [ ] `<html lang="ar" dir="rtl">`
- [ ] خط Cairo محمّل من Google Fonts
- [ ] كل خطوة لها `data-step="N"` (و `data-idea="ID"` للأفكار)
- [ ] الخطوة الأولى لها `class="step-content active"`
- [ ] باقي الخطوات `class="step-content"` (بدون active)

### الـ Manifest
- [ ] `<script type="application/json" id="slide-manifest">` موجود في `<body>`
- [ ] `lessonId` فريد
- [ ] `title` واضح
- [ ] `currentStep: 1` و `currentIdeaId` (للأفكار)
- [ ] كل خطوة لها `step` و `title` و `script` و `notes`
- [ ] `assets` تصف كل صورة وهمية
- [ ] JSON صالح (لا فواصل زائدة)

### الـ Controller
- [ ] `window.parent.postMessage` يُرسل `READY` و `MANIFEST` و `STEP_CHANGED`
- [ ] `window.addEventListener('message', ...)` يستقبل `GOTO_STEP` / `NEXT` / `PREV`
- [ ] للأفكار: يستقبل `GOTO_IDEA` ويرسل `ideaId` في `STEP_CHANGED`
- [ ] معالج النقر على `.option` للأسئلة

### التصميم
- [ ] الألوان تتبع الهوية: أزرق `#0142A0`، أحمر `#DA151C`
- [ ] حجم الخط ≥ 28px للمحتوى، ≥ 40px للعناوين
- [ ] `line-height` بين 1.5 و 1.8
- [ ] لا `text-align: justify`
- [ ] أرقام إنجليزية (0-9)

### الاختبار
- [ ] استورد الشريحة في الـ Shell
- [ ] تحقق من ظهور السكريبت في التليبرومبتر
- [ ] تحقق من ظهور النوتس (اضغط N)
- [ ] تحقق من ظهور الخطوات في القائمة
- [ ] جرّب الأسهم للتنقل
- [ ] جرّب النقر على اختيارات السؤال
- [ ] جرّب القلم على السبورة فوق الشريحة

---

## 📝 خلاصة للموديل

عند بناء شريحة لـ "بسلاسة"، التزم بهذه القواعد:

1. **البنية**: HTML + Manifest + Controller (ثلاثة أجزاء إلزامية)
2. **التواصل**: postMessage فقط (READY → MANIFEST → STEP_CHANGED)
3. **التصميم**: RTL + Cairo + ألوان البراند
4. **المحتوى**: script شفهي + notes تفصيلية + assets واضحة
5. **الأسئلة**: autoSlideMs=0 + effect=confetti + data-correct
6. **الأفكار**: data-idea + ideaId في STEP_CHANGED + انتقال تلقائي

أي مخالفة لهذه القواعد ستسبب فشل الشريحة. اقرأ هذا الملف بالكامل قبل البدء.

---

## 📞 مراجع سريعة

- بروتوكول postMessage: 7 رسائل من Shell، 6 من الشريحة
- Manifest: `lessonId`, `title`, `steps` أو `ideas`, `assets`
- Controller: `showStep()`, `notifyShell()`, message listener
- الألوان: أزرق `#0142A0`، أحمر `#DA151C`
- الخط: Cairo من Google Fonts
- الاختصارات: P (قلم)، L (ليزر)، R (طالب عشوائي)، F (ملء الشاشة)

---

**هذا الملف هو العقد الإلزامي. أي AI Model يبني شريحة لـ "بسلاسة" يجب أن يلتزم به بالكامل.**

---

## 🆕 تحديثات v9.0 — التعليقات الافتراضية + الميزات الجديدة

### 15. التعليقات الافتراضية (Virtual Comments)

#### الإلزامية:
لو الدرس فيه `virtualComments` في الـ manifest، النظام بيتفعل تلقائياً. مش لازم أي إعداد إضافي.

**مهم (v10.0):** التعليق يظهر كـ **خطوة مستقلة** قبل الشريحة. لما المدرس يضغط Next:
1. لو الخطوة التالية لها تعليق → التعليق يظهر فقط (الشريحة لا تتغير)
2. ضغطة Next تانية → الشريحة تتغير فعلاً
3. لو الخطوة التالية ليس لها تعليق → الشريحة تتغير مباشرة

#### العقد:
```json
"virtualComments": [
  {
    "step": 2,
    "ideaId": "idea-1",
    "text": "نص التعليق",
    "tone": "confident | confused | excited | curious | neutral",
    "studentHint": { "name": "اسم الطالب", "gender": "male | female" },
    "studentName": "اسم الطالب (بديل لـ studentHint.name)"
  }
]
```

#### الحقول:
| الحقل | الإلزامية | الوصف |
|-------|-----------|-------|
| `step` | ✅ إلزامي | رقم الخطوة 1-based داخل الفكرة |
| `ideaId` | ❓ اختياري | معرّف الفكرة (لو الدرس uses ideas). لو مش موجود → ينطبق على أي فكرة |
| `text` | ✅ إلزامي | نص قصير وطبيعي (2-3 كلمات أو سؤال قصير) |
| `tone` | ✅ إلزامي | واحد من: `confident`, `confused`, `excited`, `curious`, `neutral` |
| `studentHint` | 🔵 اختياري | `{ name?, gender? }` — لو الاسم موجود في الفصل، يستخدمه |
| `studentName` | 🔵 اختياري | بديل لـ `studentHint.name` — اسم الطالب كنص مباشر |

#### قواعد إلزامية:
1. `step` **إلزامي** و 1-based (أول خطوة = 1)
2. `text` **إلزامي** — نص قصير وطبيعي (2-3 كلمات أو سؤال قصير)
3. `tone` **إلزامي** — واحد من القيم الخمس
4. `studentHint` أو `studentName` **اختياري** — لو الاسم موجود في الفصل، يستخدمه؛ لو مش موجود → يختار عشوائياً من الطلاب الحاضرين؛ لو مفيش طلاب → يستخدم الاسم من التعليق مباشرة
5. مفيش تعليقين لنفس الخطوة (لو فيه، النظام يختار واحد عشوائياً)
6. **fair rotation** — النظام لا يكرر طالباً حتى يمر على الجميع

#### ألوان الـ tones (تلقائية):
| tone | اللون | المعنى |
|------|-------|-------|
| `confident` | أخضر 💪 | طالب واثق |
| `confused` | برتقالي 🤔 | طالب محتار |
| `excited` | وردي 🤩 | طالب متحمس |
| `curious` | أزرق 🧐 | طالب فضولي |
| `neutral` | رمادي 😊 | تعليق عادي |

#### نصائح لتأليف تعليقات طبيعية:
- تعليقات قصيرة (1-2 جملة)
- لغة طبيعية (مش رسمية زي الكتاب)
- تخدم الشرح (سؤال شائع، تعجب، استفسار)
- توزيع متنوع (مش كله confident أو كله confused)
- توزيع على خطوات متنوعة (مش كل التعليقات في أول الخطوات)

#### مثال كامل:
```json
"virtualComments": [
  { "step": 1, "ideaId": "intro", "studentName": "أحمد", "text": "درس شيق!", "tone": "excited" },
  { "step": 2, "ideaId": "intro", "studentName": "سارة", "text": "أنا متحمسة للبدء", "tone": "confident" },
  { "step": 1, "ideaId": "definition", "studentName": "محمد", "text": "محتاج مثال أوضح", "tone": "confused" },
  { "step": 1, "ideaId": "questions", "studentName": "علي", "text": "السؤال صعب شوية", "tone": "curious" }
]
```

---

### 16. الميزات الجديدة (v8-v9) — للعلم فقط (مش إلزامية للشرائح)

هذه الميزات موجودة في الـ Host Shell ومش بتأثر على عقد الشريحة. المدرس يستخدمها أثناء الشرح:

#### أ. StudentDNA — محرك شخصية الطالب
يحلل سلوك الطالب عبر الوقت ويبني "شخصية تعليمية":
- السرعة (هل يجيب بسرعة أم يفكر ببطء؟)
- الثبات (هل إجاباته متذبذبة أم ثابتة؟)
- الدقة (نسبة الصحيح من إجمالي المحاولات)
- الانخراط (كم مرة شارك في هذه الجلسة؟)

#### ب. SmartAudio — نظام صوتي ذكي
بدلاً من تشغيل أصوات عشوائية:
- يتذكر آخر N أصوات لتجنب التكرار
- يختار تنويعات ذكية حسب السياق (أول صح، ثالث صح متتالي، خطأ بعد فوز...)
- يستخدم TTS للإعلان الصوتي باسم الطالب

#### ج. LessonIntelligence — ذكاء الدرس
يقرأ الـ Manifest ويستخرج:
- أسئلة كل idea تلقائياً
- المصطلحات المهمة
- توصيات ذكية (أفضل لعبة تناسب المحتوى)

#### د. CelebrationsOverlay — نظام احتفالات متكامل
كل احتفال يعرض: Flash ضوئي + Banner ضخم + أيقونة عملاقة + tagline حماسية.
36 نوع احتفال (22 أصلي + 14 جديد: rocket, swords, crown, medal, shield, target, party, dragon, magic-wand, ice-crystal, lightning, treasure, medal-stars, double-rainbow).

#### هـ. ميزات إضافية:
- **GiftPersonalities**: كل هدية لها شخصية وصوت مميز
- **WeeklyChallenge**: تحدي أسبوعي مع leaderboard
- **StudentViewMode**: معاينة الدرس كما يراه الطالب
- **StudentReportPanel**: تقرير شامل لكل طالب
- **CSV Parser**: استيراد قوائم الطلاب من Excel
- **TitleRules**: ألقاب تلقائية حسب الأداء

---

### 17. اختصارات الكيبورد الكاملة (v9.0)

| الاختصار | الوظيفة |
|----------|---------|
| `→` أو `Space` | الخطوة التالية |
| `←` | الخطوة السابقة |
| `P` | القلم |
| `H` | التظليل |
| `E` | الممحاة |
| `Shift+E` | ممحاة كبيرة |
| `L` | الليزر |
| `K` | ليزر+قلم (laserpen) |
| `T` | النص |
| `S` | الأشكال |
| `A` | السهم |
| `D` | وضع الدقة |
| `R` | طالب عشوائي |
| `V` | صوت نجاح + وميض أخضر |
| `B` | صوت خطأ + وميض أحمر |
| `X` | خطأ + خصم نقطة |
| `G` | احتفال |
| `C` | مسح السبورة |
| `Ctrl+Z` | تراجع |
| `Ctrl+Y` أو `Ctrl+Shift+Z` | إعادة (Redo) |
| `M` | كتم الصوت |
| `W` | تفعيل/إيقاف السبورة |
| `N` | النوتس |
| `+` أو `=` | نقطة للطالب |
| `F` | ملء الشاشة |
| `1-6` | ألوان القلم |
| `Q` | تبديل سريع للون التالي |
| `[` أو `-` | تصغير السمك |
| `]` | تكبير السمك |
| `Shift+1/2/3` | ألوان الليزر |
| `Escape` | إغلاق كل الأدوات |

---

**هذا الملف هو العقد الإلزامي. أي AI Model يبني شريحة لـ "بسلاسة" يجب أن يلتزم به بالكامل.**
