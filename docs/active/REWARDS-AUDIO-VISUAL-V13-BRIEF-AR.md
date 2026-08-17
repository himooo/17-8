# مواصفات حزمة الأصوات والصور V13

## الهدف

رفع جودة الإحساس بالنجاح والمكافأة داخل غرفة عمليات المدرس دون إزعاج الحصة أو زيادة الحمل على الطالب. الأصوات مؤثرات قصيرة وليست موسيقى خلفية، والصور أصول شفافة ذات silhouette واضح تظهر جيداً في OBS والواجهة الداكنة.

## فئات الصوت المطلوبة

| المعرّف المقترح | الحالة | الطول المستهدف | الشخصية الصوتية |
|---|---|---:|---|
| `bisalasa-success-bright` | إجابة صحيحة | 0.6–1.0s | نغمتان صاعدتان crystal bell مع نهاية دافئة |
| `bisalasa-success-perfect` | سلسلة صحيحة/إتقان فكرة | 1.0–1.5s | arpeggio صاعد قصير مع chime نهائي |
| `bisalasa-gift-reveal` | ظهور هدية | 0.8–1.2s | sparkle + soft whoosh + reveal chime |
| `bisalasa-badge-unlock` | فتح شارة | 1.2–1.8s | ceremonial bell + short heroic accent |
| `bisalasa-celebration-small` | احتفال فردي هادئ | 1.0–1.5s | clap خفيف وsparkle بلا ضجيج |
| `bisalasa-celebration-class` | نجاح الصف | 1.8–2.5s | crowd cheer دافئ مع fanfare قصيرة |
| `bisalasa-fireworks-impact` | ألعاب نارية | 1.2–1.8s | rising whoosh ثم impact واسع، بلا peak مؤلم |
| `bisalasa-level-up` | صعود مستوى | 1.3–1.8s | power-up صاعد مع bell نهائي |
| `bisalasa-gentle-correction` | خطأ/إعادة محاولة | 0.5–0.8s | soft low bonk غير محبط |
| `bisalasa-countdown-tick` | عد تنازلي | 0.15–0.3s | tick واضح قصير قابل للتكرار |
| `bisalasa-student-picker` | اختيار طالب عادل | 0.8–1.2s | wheel tick ثم neutral reveal |
| `bisalasa-session-finish` | نهاية الحصة | 2.0–3.0s | warm resolution/fanfare هادئة بلا مبالغة |

## هوية الصور

كل صورة PNG شفافة، 1024x1024، object centered، حواف نظيفة، ألوان تعليمية مبهجة، إضاءة ناعمة، بدون نص أو watermark، وتعمل على خلفية داكنة وفاتحة. تُستخدم الصور داخل بطاقة الهدية لا كصور واقعية لمنتج مدفوع، لذلك يجب أن تكون رمزية وآمنة للأطفال.

## صور الهدايا الجديدة

`rocket-star.png`، `rainbow-medal.png`، `magic-book.png`، `math-trophy.png`، `super-pencil.png`، `idea-lamp.png`، `comet-sticker.png`، `golden-crown.png`، `team-badge.png`، `confetti-box.png`، `planet-puzzle.png`، `heart-encouragement.png`.

## ضوابط الدمج

يظل الصوت خاضعاً لـmaster/effects volume وmute وتقليل الحركة، ويُحمّل عند unlock أو عند أول استعمال. إذا فشل الأصل الجديد يستخدم SOUND_FILES الحالي كـfallback. لا تُستبدل الأصول القديمة حذفاً؛ تضاف aliases واضحة حتى لا تنكسر بيانات الهدايا أو الاحتفالات المحفوظة.
