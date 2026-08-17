# ملاحظات تحقق API الخارجية — 15 أغسطس 2026

هذه الملاحظات تحفظ الحقائق الخارجية التي ستؤثر على تصميم V10، ولا تمثل بديلاً عن عقود الكود المحلية.

| المصدر | ما تم التحقق منه | أثر التصميم |
|---|---|---|
| [OpenAI API Reference](https://developers.openai.com/api/reference/overview/) | المرجع الحالي يميز Responses للطلبات المباشرة واستخدام الأدوات ومدخلات النص/الصوت/الصورة، ويعرض مسارات Audio وImages وEmbeddings وModels وModerations، مع bearer auth وضرورة عدم كشف المفتاح في العميل | نستخدم adapter server-side، ونفصل capabilities حسب provider بدلاً من افتراض أن كل endpoint Chat Completions |
| [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) | Anthropic يعرّف Messages وCreate a Message وCount tokens وList Models كمسارات منفصلة، وليس مجرد OpenAI-compatible chat endpoint | adapter Anthropic مستقل بالـheaders والـrequest shape، مع عدم إسقاطه على Google أو OpenAI |
| [OpenAI Embeddings guide](https://developers.openai.com/api/docs/guides/embeddings) | embeddings تحول النص إلى vectors لاستخدامات البحث والتجميع | semantic search محلي يحتاج تخزين vectors وحدود حجم وfallback نصي عند غياب provider |
| [OpenAI Images and vision](https://developers.openai.com/api/docs/guides/images-vision) | الصور والرؤية مسار capabilities مستقل عن النص | نستخدم image/vision adapters اختيارية مع رفع آمن وعدم حفظ أسرار في المتصفح |
| [ElevenLabs TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) | TTS يعيد صوتاً من endpoint مخصص ويحتاج voice id وAPI key | يُعامل كـprovider صوتي server-side، وليس كامتداد مباشر لـTTS Google الحالي |

## قرارات تطبيقية

تظل مفاتيح API في الخادم/قاعدة البيانات المشفرة ولا تعاد إلى العميل. كل provider يعلن `capabilities` مثل text، vision، image، stt، tts، embeddings، tools، streaming، ولا يظهر زر غير مدعوم. الفشل في provider خارجي يجب أن يعيد fallback محلياً أو يدخل retry queue، ولا يُفقد نتيجة المدرس بصمت.

لا تُفعل مكالمات خارجية حقيقية في الاختبار الآلي؛ تستخدم mock provider محلياً مع اختبارات request shape، التدوير، redaction، timeout، retry، والتسجيل. الاختبار الحقيقي يحتاج مفتاح المدرس وموافقته وسياسة خصوصية واضحة.
