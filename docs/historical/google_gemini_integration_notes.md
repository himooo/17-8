> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# Google Gemini integration notes

- Official API-key guidance: https://ai.google.dev/gemini-api/docs/api-key
  - Keep keys confidential and never expose them client-side in production.
  - Google recommends environment variables or a secure secret manager.
  - The docs state that unrestricted standard keys are rejected and that new AI Studio keys are auth keys; restricted keys should be used.
- Official text generation: https://ai.google.dev/gemini-api/docs/text-generation
  - Current docs recommend the Interactions API, but the generateContent API remains documented.
  - Text generation supports system instructions, generation configuration, streaming, and multimodal inputs.
- Official generateContent reference: https://ai.google.dev/api/generate-content
  - Endpoint shape: POST https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent
  - Request contains contents and optional systemInstruction/generationConfig.
- Official structured output: https://ai.google.dev/gemini-api/docs/structured-output
  - JSON Schema can be requested using response_format with mime_type application/json.

Implementation decision for Bisalasa: use a server-side generateContent proxy because the current app is a local Next.js/SQLite app and the user requested many Google keys with rotation. Keys are encrypted at rest with AES-256-GCM and only masked summaries are returned to the browser. Provider calls use bounded input/output, timeout, in-memory rate limiting, usage events, and rotation across active keys. The AI feature is disabled by default and the UI does not send student names or records.
