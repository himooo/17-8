# 📋 العقد الكامل بين "بسلاسة" (Host Shell) وأي شريحة (Guest Slide)

# إعدادات الشرائح — بسلاسة

**آخر تحديث:** 16 أغسطس 2026 (جولة الإصلاحات الأمنية وقاعدة البيانات)

> **الحالة:** عقد توافق مستمر يدعم HTML وReact والأفكار المتداخلة. عبارات V5/V9 داخل الأمثلة تاريخية وتشرح سبب بعض القواعد؛ المرجع التشغيلي الحالي هو `VIBE_CODING_CONTRACT.md` و`USER_GUIDE.md`.

> **النسخة 9.0 - يدعم HTML + React + الأفكار المتداخلة + PWA**
> اقرأ هذا الملف بالكامل قبل بناء أي شريحة. كل التفاصيل هنا إلزامية.

---

## 🆕 الجديد في الإصدار 5.0

1. **ليزر بخط يتبع الماوس** - يرسم مساراً يتلاشى تدريجياً (trail effect) بدلاً من نقطة ثابتة. مفيد للإشارة حول كلمة أو شكل.
2. **أداة "ماوس عادي"** - زر في القائمة الجانبية لإلغاء السبورة والتفاعل مباشرة مع أزرار الشريحة.
3. **هامش علوي** - فجوة صغيرة (8px) بين منطقة العرض والقائمة العلوية.
4. **تكبير/تصغير من الزاوية** - اسحب زاوية منطقة العرض لتكبير أو تصغير حجمها.
5. **عرض أفقي/عمودي** - زرار لتحويل العرض بين 16:9 (أفقي) و 9:16 (عمودي).
6. **PWA** - يمكن تثبيت التطبيق على Android كتطبيق أصلي.
7. **اختصارات جديدة**: G (احتفال)، B (خطأ)، V (نجاح).
8. **7 أزرار مكافآت** للطلاب (صحيحة +3، محاولة +1، نجمة +5، ذهبية +10، إبداع +7، مساعدة +4، خطأ).

---

## 🎯 القاعدة الذهبية

الإطار (Host) يعرض شريحتك داخل `iframe` معزول. كل تواصل بينكما يتم عبر `window.postMessage` فقط.

**أنت مسؤول عن:**
1. عرض المحتوى البصري (HTML/CSS/JS أو React)
2. الاستجابة لأوامر التنقل (Next/Prev/Goto)
3. إرسال بياناتك الوصفية (Manifest) للإطار عند التحميل

**الإطار مسؤول عن:**
- التليبرومبتر (يعرض السكريبت بألوان متبادلة)
- لوحة النوتس (يعرض notes)
- لوحة الأصول (يعرض assets)
- إدارة الطلاب والنقاط والشارات
- السبورة الذكية فوق شريحتك (قلم، ليزر، أشكال، أسهم، صح، خطأ، نجمة)

---

## 🔌 بروتوكول التواصل (postMessage)

### 1) رسائل من Shell → الشريحة (أوامر)

| type | الحقول | متى تُرسل | الواجب عليك |
|------|--------|-----------|-------------|
| `GOTO_STEP` | `step: number, ideaId?: string` | عند الضغط على خطوة أو السهم | اعرض الخطوة N من الفكرة المحددة |
| `NEXT` | — | السهم الأيمن / Space | اعرض الخطوة التالية (أو الفكرة التالية) |
| `PREV` | — | السهم الأيسر | اعرض الخطوة السابقة (أو الفكرة السابقة) |
| `GOTO_IDEA` | `ideaId: string, step?: number` | عند الضغط على فكرة في القائمة | اعرض الفكرة المحددة |
| `REQUEST_MANIFEST` | — | عند تحميل الشريحة | أرسل الـ Manifest كاملاً |
| `REQUEST_CURRENT_STEP` | — | (نادر) | أرسل STEP_CHANGED |
| `PLAY_SOUND` | `sound: "success"\|"error"\|"celebrate"\|"click"` | نادر | شغّل الصوت المطلوب |

### 2) رسائل من الشريحة → Shell (استجابات)

| type | الحقول | متى تُرسل |
|------|--------|-----------|
| `MANIFEST` | `payload: SlideManifest` | عند التحميل أو عند الطلب |
| `STEP_CHANGED` | `step: number, totalSteps: number, ideaId?: string` | عند تغيير الخطوة |
| `IDEA_CHANGED` | `ideaId: string, step: number, title?: string` | عند تغيير الفكرة |
| `READY` | — | عند انتهاء تحميل DOM |
| `REQUEST_SOUND` | `sound: "success"\|"error"\|"celebrate"\|"click"` | عندما تطلب صوتاً |
| `ERROR` | `message: string` | عند حدوث خطأ |

---

## 📦 مخطط البيانات (Manifest Schema v3.0)

```typescript
interface SlideManifest {
  // ===== بيانات الدرس =====
  lessonId: string;                    // معرّف فريد
  title: string;                       // عنوان الدرس
  subtitle?: string;                   // وصف مختصر
  contentType?: "html" | "react";      // نوع المحتوى (اختياري)
  totalSteps?: number;                 // إجمالي الخطوات (يُحسب تلقائياً من ideas)
  currentStep: number;                 // الخطوة الحالية (1 عند البدء)
  currentIdeaId?: string;              // الفكرة النشطة (إذا وجدت أفكار)
  aspectRatio?: "16:9" | "9:16" | "4:3" | "1:1";
  targetAge?: "primary-lower" | "primary-upper" | "preparatory";

  // ===== نمط 1: خطوات مسطحة (flat) - درس بسيط =====
  steps?: SlideStep[];

  // ===== نمط 2: أفكار متداخلة (nested ideas) - درس معقد =====
  ideas?: SlideIdea[];

  // ===== الأصول (الصور الوهمية) =====
  assets?: SlideAsset[];
}

interface SlideIdea {
  id: string;                          // معرّف فريد للفكرة
  title: string;                       // عنوان الفكرة
  description?: string;
  color?: "blue" | "red" | "green" | "amber" | "purple" | "cyan";
  steps: SlideStep[];                  // خطوات هذه الفكرة فقط
}

interface SlideStep {
  step: number;                        // 1-indexed (داخل الفكرة)
  title?: string;                      // عنوان مختصر
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
  id: string;                          // مثل: img_01_05_02
  description: string;
  type: "geometric-figure" | "illustration" | "photo" | "chart" | "icon";
  status: "placeholder" | "final";
}
```

---

## 📝 قواعد السكريبت (script)

السكريبت يُقسم تلقائياً لجمل بناءً على علامات الترقيم: `.` `،` `؛` `!` `؟` `\n`

**الألوان المتبادلة (تلقائية):**
- الجملة 1: **أزرق فاتح** (font-semibold)
- الجملة 2: **أبيض** (foreground)
- الجملة 3: أزرق فاتح
- الجملة 4: أبيض
- الجملة 5: **أصفر/أحمر** (font-bold) — كل 5 جمل تأكيد

**ميزة تحديد الجملة:** المدرس يمكنه الضغط على أي جملة في التليبرومبتر لتُلون بالأحمر (تحديد الموضع). هذا يساعده على معرفة أين توقف في الشرح.

---

## 🎨 القالب الجاهز للنسخ (HTML - Flat Steps)

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>عنوان الدرس</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
    body { width: 100vw; height: 100vh; overflow: hidden; background: #fff; color: #1A1A1A; }
    .slide-container { width: 100%; height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 40px; position: relative; }
    .step-content { display: none; }
    .step-content.active { display: flex; flex-direction: column; align-items: center;
      gap: 1.5rem; animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); } }
    .title { font-size: 3rem; font-weight: 800; color: #0142A0; }
    .content { font-size: 1.6rem; text-align: center; max-width: 900px; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="slide-container">
    <div class="step-content active" data-step="1">
      <h1 class="title">عنوان الخطوة الأولى</h1>
      <p class="content">محتوى الخطوة</p>
    </div>
    <div class="step-content" data-step="2">
      <h1 class="title">عنوان الخطوة الثانية</h1>
      <p class="content">محتوى الخطوة</p>
    </div>
  </div>

  <script type="application/json" id="slide-manifest">
  {
    "lessonId": "lesson-XX",
    "title": "عنوان الدرس",
    "totalSteps": 2,
    "currentStep": 1,
    "aspectRatio": "16:9",
    "targetAge": "preparatory",
    "steps": [
      {
        "step": 1,
        "title": "عنوان الخطوة الأولى",
        "type": "content",
        "script": "السكريبت هنا. كل جملة بلون مختلف تلقائياً.",
        "notes": "ملاحظات المدرس.",
        "autoSlideMs": 8000
      },
      {
        "step": 2,
        "title": "سؤال",
        "type": "question",
        "script": "السؤال: كذا؟",
        "question": {
          "text": "نص السؤال",
          "correctAnswer": "الإجابة",
          "options": ["خ1", "خ2", "خ3", "خ4"],
          "rewardPoints": 3
        },
        "effect": "confetti",
        "autoSlideMs": 0
      }
    ],
    "assets": []
  }
  </script>

  <script>
    (function() {
      let currentStep = 1;
      function getManifest() {
        const el = document.getElementById('slide-manifest');
        if (!el) return null;
        try { return JSON.parse(el.textContent); } catch { return null; }
      }
      function getTotalSteps() {
        const m = getManifest();
        return m ? m.totalSteps : 1;
      }
      function showStep(step) {
        currentStep = step;
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        const target = document.querySelector(`.step-content[data-step="${step}"]`);
        if (target) target.classList.add('active');
        notifyShell({ type: 'STEP_CHANGED', step: step, totalSteps: getTotalSteps() });
      }
      function notifyShell(msg) { window.parent.postMessage(msg, '*'); }

      window.addEventListener('message', function(event) {
        const data = event.data;
        if (!data || !data.type) return;
        const total = getTotalSteps();
        switch (data.type) {
          case 'GOTO_STEP': showStep(data.step); break;
          case 'NEXT': if (currentStep < total) showStep(currentStep + 1); break;
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
        showStep(1);
      });
    })();
  </script>
</body>
</html>
```

---

## 🎨 القالب الجاهز (HTML - Nested Ideas)

عندما يكون الدرس مقسماً لأفكار متعددة، كل فكرة لها خطواتها الخاصة:

```html
<!-- نفس الـ head والـ style -->
<body>
  <div class="slide-container">
    <!-- IDEA 1 -->
    <div class="step-content active" data-step="1" data-idea="idea-1">...</div>
    <div class="step-content" data-step="2" data-idea="idea-1">...</div>
    <!-- IDEA 2 -->
    <div class="step-content" data-step="1" data-idea="idea-2">...</div>
    <div class="step-content" data-step="2" data-idea="idea-2">...</div>
  </div>

  <script type="application/json" id="slide-manifest">
  {
    "lessonId": "lesson-XX",
    "title": "عنوان الدرس",
    "currentStep": 1,
    "currentIdeaId": "idea-1",
    "ideas": [
      {
        "id": "idea-1",
        "title": "الفكرة الأولى",
        "color": "blue",
        "steps": [
          { "step": 1, "title": "...", "script": "...", "notes": "..." },
          { "step": 2, "title": "...", "script": "...", "notes": "..." }
        ]
      },
      {
        "id": "idea-2",
        "title": "الفكرة الثانية",
        "color": "green",
        "steps": [
          { "step": 1, "title": "...", "script": "...", "notes": "..." },
          { "step": 2, "title": "...", "script": "...", "notes": "..." }
        ]
      }
    ],
    "assets": []
  }
  </script>

  <script>
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
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        const selector = ideaId
          ? `.step-content[data-idea="${ideaId}"][data-step="${step}"]`
          : `.step-content[data-step="${step}"]`;
        const target = document.querySelector(selector);
        if (target) target.classList.add('active');
        const idea = getCurrentIdea();
        const total = idea ? idea.steps.length : 1;
        notifyShell({
          type: 'STEP_CHANGED',
          step: step,
          totalSteps: total,
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
          case 'GOTO_STEP': showStep(data.step, data.ideaId); break;
          case 'NEXT': nextStep(); break;
          case 'PREV': prevStep(); break;
          case 'GOTO_IDEA': showStep(data.step || 1, data.ideaId); break;
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
  </script>
</body>
</html>
```

---

## ⚛️ استيراد React Apps

### الطريقة 1: React Build → HTML inline (موصى بها)

1. ابنِ تطبيق React كـ static build:
   ```bash
   npm run build  # ينتج dist/ أو build/
   ```

2. الـ `index.html` الناتج يحتوي على `<link rel="stylesheet" href="/assets/index.css">` و `<script src="/assets/index.js"></script>`

3. **Inline الـ CSS والـ JS داخل الـ HTML** حتى يعمل في الـ iframe:
   - افتح `index.html`
   - استبدل كل `<link rel="stylesheet" href="...">` بـ `<style>...محتوى CSS...</style>`
   - استبدل كل `<script src="...">` بـ `<script>...محتوى JS...</script>`

4. أضف الـ Manifest script tag (مثل HTML العادي)

5. أضف كود الـ Controller (مثل HTML العادي)

### الطريقة 2: React Component مع تكامل مباشر

إذا كنت تبني React specifically للـ Shell، استخدم هذا النمط:

```jsx
// App.jsx
import { useEffect } from 'react';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [currentIdeaId, setCurrentIdeaId] = useState('idea-1');

  // الـ Manifest (نفس الـ JSON في الـ HTML)
  const manifest = {
    lessonId: "lesson-react-XX",
    title: "عنوان الدرس",
    currentStep: 1,
    currentIdeaId: "idea-1",
    ideas: [...],
    assets: []
  };

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      switch (data.type) {
        case 'GOTO_STEP':
          setCurrentStep(data.step);
          if (data.ideaId) setCurrentIdeaId(data.ideaId);
          break;
        case 'NEXT': /* منطق الانتقال للخطوة التالية */ break;
        case 'PREV': /* منطق الرجوع */ break;
        case 'GOTO_IDEA':
          setCurrentIdeaId(data.ideaId);
          setCurrentStep(data.step || 1);
          break;
        case 'REQUEST_MANIFEST':
          window.parent.postMessage({
            type: 'MANIFEST',
            payload: { ...manifest, currentStep, currentIdeaId }
          }, '*');
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentStep, currentIdeaId]);

  useEffect(() => {
    // إرسال READY و MANIFEST عند التحميل
    window.parent.postMessage({ type: 'READY' }, '*');
    window.parent.postMessage({
      type: 'MANIFEST',
      payload: { ...manifest, currentStep, currentIdeaId }
    }, '*');
  }, []);

  // إرسال STEP_CHANGED عند تغيير الخطوة
  useEffect(() => {
    window.parent.postMessage({
      type: 'STEP_CHANGED',
      step: currentStep,
      totalSteps: manifest.ideas?.find(i => i.id === currentIdeaId)?.steps.length || 0,
      ideaId: currentIdeaId
    }, '*');
  }, [currentStep, currentIdeaId]);

  return (
    <div className="slide-container">
      {/* محتوى الشريحة بناءً على currentStep و currentIdeaId */}
    </div>
  );
}
```

### ملاحظات هامة لـ React:

1. **Manifest script tag**: لا تحتاجه في React، استخدم الكود مباشرة
2. **postMessage**: استخدم `window.parent.postMessage(msg, '*')` دائماً
3. **CORS**: الـ iframe بـ data: URL يعتبر cross-origin، لكن postMessage يعمل عبر cross-origin
4. **Fonts**: حمّل Cairo من Google Fonts في index.html
5. **Sandbox**: الـ Shell يستخدم sandbox أوسع لدعم React

---

## ✅ قائمة التحقق النهائية

### الهيكل
- [ ] `<html lang="ar" dir="rtl">`
- [ ] خط Cairo محمّل من Google Fonts
- [ ] كل خطوة لها `data-step="N"` (و `data-idea="ID"` للأفكار المتداخلة)
- [ ] الخطوة الأولى لها `class="step-content active"`
- [ ] باقي الخطوات `class="step-content"` (بدون active)

### الـ Manifest
- [ ] `<script type="application/json" id="slide-manifest">` موجود
- [ ] `currentStep: 1` و `currentIdeaId: "idea-1"` (للأفكار)
- [ ] كل خطوة لها `step` و `title` و `script`
- [ ] `assets` تصف كل صورة وهمية

### الكونترولر
- [ ] `window.parent.postMessage` يُرسل MANIFEST و STEP_CHANGED
- [ ] `window.addEventListener('message', ...)` يستقبل GOTO_STEP / NEXT / PREV / GOTO_IDEA
- [ ] `STEP_CHANGED` ترسل `ideaId` (للأفكار المتداخلة)

### التصميم
- [ ] الألوان تتبع الهوية: أزرق #0142A0، أحمر #DA151C
- [ ] حجم الخط ≥ 28px للمحتوى، ≥ 40px للعناوين
- [ ] `line-height` بين 1.5 و 1.8
- [ ] لا تستخدم `text-align: justify`

---

## 🧪 كيفية الاختبار

1. احفظ ملف HTML باسم واضح
2. افتح الإطار (بسلاسة)
3. اضغط على أيقونة **المنهج**
4. اضغط على **"استيراد شرائح"** أو اسحب الملف
5. اضغط على اسم الدرس في القائمة ليُحمّل
6. تحقق من:
   - ظهور السكريبت في التليبرومبتر (بألوان متبادلة)
   - ظهور ملاحظات المدرس (اضغط N لعرضها overlay)
   - ظهور الأصول في لوحة Assets
   - ظهور الخطوات في القائمة الشجرية (مع الأفكار)
7. جرّب الأسهم للتنقل بين الخطوات والأفكار
8. جرّب الاختصارات:
   - `→ / Space`: التالي
   - `←`: السابق
   - `P`: قلم | `H`: تظليل | `E`: ممحاة | `L`: ليزر (بخط يتبع الماوس)
   - `T`: نص | `S`: أشكال (دائرة/مستطيل/مثلث) | `A`: سهم
   - `R`: طالب عشوائي | `V`: صوت نجاح | `B`: صوت خطأ | `G`: 🎉 احتفال
   - `C`: مسح السبورة | `Ctrl+Z`: تراجع
   - `M`: كتم الصوت | `W`: تفعيل/إيقاف السبورة
   - `F`: ملء الشاشة | `N`: عرض النوتس overlay
   - `1-6`: ألوان القلم | `+`: نقطة للطالب
9. جرّب العرض:
   - **عرض أفقي 16:9** / **عرض عمودي 9:16** (من القائمة الجانبية)
   - **تكبير/تصغير من الزاوية** (اسحب الزاوية السفلية اليسرى)
   - **ماوس عادي** (للتفاعل مع الشريحة)

---

## 🎨 أدوات السبورة الذكية المتاحة

عندما يفعّل المدرس السبورة، يمكنه استخدام:

| الأداة | الوصف | الاختصار |
|--------|-------|----------|
| **ماوس عادي** | للتفاعل مع أزرار الشريحة (يلغي السبورة) | زر في القائمة الجانبية |
| قلم | قلم عادي بألوان مختلفة + مؤشر دائري بحجم القلم | P |
| تظليل | قلم نصف شفاف سميك | H |
| ممحاة | تمسح الرسم + مؤشر دائري أحمر | E |
| **ليزر بخط** | **يرسم مساراً أحمر يتلاشى خلال 800ms (trail effect)** | L |
| نص | كتابة نص على الشريحة | T |
| دائرة | رسم دائرة | S |
| مستطيل | رسم مستطيل | S |
| مثلث | رسم مثلث | S |
| سهم | رسم سهم باتجاه | A |
| صح ✓ | علامة صحيحة | - |
| خطأ ✗ | علامة خاطئة | - |
| نجمة ★ | نجمة تحفيزية | - |
| تراجع | يتراجع عن آخر رسم | Ctrl+Z |
| مسح الكل | يمسح كل الرسم | C |

**ألوان القلم:** أزرق، أحمر، أخضر، أصفر، أبيض، أسود (اختصارات 1-6)
**سماكة القلم:** 4 مستويات (1, 2, 4, 6)

### 🆕 ميزات السبورة الجديدة في v5.0

1. **ليزر بخط يتبع الماوس**: عند تحريك الليزر، يرسم خطاً أحمر يتلاشى تدريجياً خلال 800ms. هذا يسمح للمدرس بالإشارة حول كلمة أو شكل بحركة دائرية، فيرى الطلاب المسار كاملاً.

2. **مؤشر مخصص لكل أداة**: عند تفعيل القلم/التظليل/الممحاة، يظهر مؤشر دائري بحجم القلم يتبع الماوس. لكل أداة لون مناسب (أزرق للقلم، شفاف للتظليل، أحمر للممحاة).

3. **زر "ماوس عادي"**: في القائمة الجانبية، زر يُفعّل وضع التحديد (select) الذي يلغي السبورة ويسمح بالتفاعل المباشر مع أزرار الشريحة. مفيد عندما تريد الضغط على زر داخل الشريحة دون الحاجة لإيقاف السبورة من الإعدادات.

---

## 🎵 الأصوات المتاحة

الـ Shell يدعم 4 أصوات:
- `success`: نغمة صاعدة لطيفة (للإجابة الصحيحة)
- `error`: نغمتان هابطتان (للإجابة الخاطئة)
- `celebrate`: احتفال كبير 5 نغمات (للإنجازات)
- `click`: نقرة قصيرة (للتنقل)

لطلب صوت من الشريحة:
```js
window.parent.postMessage({ type: 'REQUEST_SOUND', sound: 'success' }, '*');
```

---

## ⚠️ أخطاء شائعة يجب تجنبها

1. **نسيان `id="slide-manifest"`** - الإطار لن يقرأ البيانات
2. **عدم إرسال `STEP_CHANGED` بعد `showStep`** - الـ Shell لن يعرف أن الخطوة تغيرت
3. **`currentStep` لا يبدأ من 1** - الـ Shell سيعرض خطأ
4. **عدم إرسال `MANIFEST` عند التحميل** - الإطار لن يعرف بياناتك
5. **استخدام `alert()` أو `confirm()`** - تتعارض مع الـ iframe
6. **عدم إرسال `ideaId` في `STEP_CHANGED`** - الـ Shell لن يعرف أي فكرة أنت فيها
7. **الاعتماد على `localStorage`** - قد لا يعمل في sandbox

---

## 📚 ملاحظات تقنية

- **Sandbox**: الشرائح تعمل في `iframe` بـ sandbox أوسع يسمح بـ scripts, forms, popups, modals, presentations
- **الصوت**: استخدم `<audio>` أو Web Audio API مباشرة
- **الأنيميشن**: GSAP، Framer Motion، CSS animations - كلها مدعومة
- **الرياضيات**: استخدم KaTeX أو MathJax (تحميل من CDN)
- **الرسوم التفاعلية**: JSXGraph، D3.js، Three.js - كلها مدعومة
- **الخط**: Cairo محمّل مسبقاً في الإطار، لكن حمله في شريحتك أيضاً للتوافق

---

## 🆘 استكشاف الأخطاء

**المشكلة: الشريحة لا تظهر**
- تأكد أن الملف بصيغة `.html` أو `.htm`
- افتح Console (F12) وابحث عن أخطاء JavaScript

**المشكلة: السكريبت لا يظهر في التليبرومبتر**
- تأكد أن `script` موجود في كل خطوة في الـ Manifest
- تأكد من صيغة JSON صحيحة (لا فواصل زائدة)

**المشكلة: الخطوات لا تتغير**
- تأكد أن `data-step` يطابق `step` في الـ Manifest
- تأكد أن كود الـ Controller موجود ويعمل
- تأكد أنك ترسل `STEP_CHANGED` بعد `showStep`

**المشكلة: الأفكار لا تتنقل**
- تأكد أن كل `data-idea` يطابق `id` الفكرة في الـ Manifest
- تأكد أنك ترسل `ideaId` في `STEP_CHANGED`
- تأكد أن `nextStep()` و `prevStep()` يتنقلان بين الأفكار

**المشكلة: الـ Manifest لا يُقرأ**
- تأكد أن `<script type="application/json" id="slide-manifest">` موجود في `<body>`
- تأكد أن JSON صالح (اختبره على jsonlint.com)

---

## 🎯 أمثلة جاهزة

في مجلد `public/slides/` ستجد:
- `lesson-fractions.html` - درس بسيط بـ 6 خطوات (flat)
- `lesson-fractions-ideas.html` - درس بـ 3 أفكار متداخلة (8 خطوات إجمالاً)
- `demo-lesson.html` - درس عن المعادلات التربيعية (5 خطوات)
- `template-blank.html` - قالب فارغ للبدء

انسخ أي منها كنقطة انطلاق وعدّل المحتوى والـ Manifest.

---

## 💬 Virtual Comments (v9.0) — التعليقات الافتراضية

### Schema
في الـ manifest JSON، أضف `virtualComments` array:

```json
{
  "virtualComments": [
    {
      "step": 2,
      "text": "دي سهلة جدا يامستر!",
      "tone": "confident",
      "studentHint": { "name": "مشمشة", "gender": "female" }
    },
    {
      "step": 3,
      "text": "أنا مش فاهم ليه كدا؟",
      "tone": "confused",
      "studentHint": { "name": "بندق", "gender": "male" }
    }
  ]
}
```

### الحقول:
| field | type | required | description |
|-------|------|----------|-------------|
| step | number | ✅ | رقم الخطوة (1-based) |
| ideaId | string | ❌ | لو الدرس ideas-mode |
| text | string | ✅ | نص التعليق (قصير وطبيعي) |
| tone | "confident" \| "confused" \| "excited" \| "curious" \| "neutral" | ✅ | نبرة التعليق |
| studentHint.name | string | ❌ | لو الاسم موجود في الفصل النشط → يستخدمه |
| studentHint.gender | "male" \| "female" | ❌ | للـ avatar (👦/👧) |

### القواعد:
1. `step` 1-based (أول خطوة = 1)
2. لو `studentHint.name` موجود في الفصل → يستخدمه مباشرة
3. لو مش موجود → يختار عشوائياً من طلاب الفصل بـ fair rotation
4. النظام بيتفعل تلقائياً لو الـ manifest فيه `virtualComments`
5. التعليقات بتختفي خلال الألعاب (عشان ميتعارضش مع الـ game overlay)
6. الـ bubble بيختفي تلقائياً بعد 6 ثواني (قابل للتعديل في Settings)
7. المدرس يقدر يوقف الاختفاء بالـ hover، ويقفل بالـ click

### نبرات التعليقات:
| tone | اللون | الاستخدام | Avatar |
|------|-------|-----------|--------|
| `confident` | أخضر | "دي سهلة"، "أنا عارف" | 😎 |
| `confused` | أصفر | "أنا مش فاهم"، "إيه ده؟" | 🤔 |
| `excited` | وردي | "وااو!"، "جميل جدا"! | 🤩 |
| `curious` | أزرق | "طيب لو كده إيه؟"، "إزاي؟" | 🧐 |
| `neutral` | رمادي | "تمام", "ماشي" | 😊 |

### مثال كامل:
استورد `public/slides/fractions-virtual-comments.html` لتجربة 4 تعليقات على خطوات مختلفة.

---

## 🆕 تحديثات v9.0 للـ Host Shell (لا تؤثر على عقد الشرائح)

عقد الـ postMessage + manifest JSON **لم يتغير منذ v6.0** — كل الشرائح القديمة تعمل كما هي.

التحديثات دي كلها داخلية في الـ Host Shell:
- **36 نوع احتفال** (22 أصلي + 14 جديد)
- **StudentDNA**: تحليل شخصية الطالب
- **SmartAudio**: نظام صوتي ذكي (88 صوت)
- **LessonIntelligence**: تحليل تلقائي للدرس
- **Virtual Comments**: تعليقات افتراضية من الطلاب
- **Redo** (Ctrl+Shift+Z) + **Shift constraint** + **Precision mode**
- **StudentViewMode** + **StudentReportPanel** + **WeeklyChallenge**
- **CSV Parser** + **TitleRules** + **GiftPersonalities**
