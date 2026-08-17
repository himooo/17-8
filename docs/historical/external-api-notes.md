> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.
>

# External API notes used for this implementation

1. Telegram Bot API: https://core.telegram.org/bots/api
   - Bot requests use https://api.telegram.org/bot<TOKEN>/METHOD_NAME.
   - JSON and form requests are supported; multipart/form-data is used for file uploads.
   - Webhooks POST JSON updates to an HTTPS URL.
   - setWebhook accepts secret_token and Telegram sends X-Telegram-Bot-Api-Secret-Token.
   - getUpdates and webhooks are mutually exclusive.
   - Webhook docs list supported ports 443, 80, 88, 8443.

2. OpenAI List Models: https://developers.openai.com/api/reference/resources/models/methods/list
   - GET /models with Authorization: Bearer key.
   - Response includes data array and model id.

3. Google Gemini Models API: https://ai.google.dev/api/models
   - GET https://generativelanguage.googleapis.com/v1beta/models?key=KEY.
   - models.list is paginated with nextPageToken/pageToken.
   - Model names are returned as models/{model}; supportedGenerationMethods can include generateContent.

Implementation implications:
- Use a server-side discovery endpoint; never send API keys to the browser.
- Normalize Google models/{id} and OpenAI-compatible data[].id/model/name into one model list.
- Keep Telegram token and webhook secret server-side and verify the secret header on webhook requests.
- Keep Telegram webhook delivery optional and non-blocking for local classroom operation.
