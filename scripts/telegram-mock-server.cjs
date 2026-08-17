#!/usr/bin/env node
const http = require("node:http");
const port = Number(process.env.MOCK_PORT || 3034);
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    const path = req.url || "";
    const method = path.split("/").pop() || "unknown";
    let result;
    if (method === "getMe") {
      result = { id: 123456789, is_bot: true, first_name: "QA Bot", username: "bisalasa_qa_bot" };
    } else if (method === "getWebhookInfo") {
      result = { url: "", has_custom_certificate: false, pending_update_count: 0, allowed_updates: [] };
    } else if (method === "setWebhook" || method === "deleteWebhook") {
      result = true;
    } else {
      result = { method, accepted: true, bodyLength: body.length };
    }
    const payload = { ok: true, result };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
});
server.listen(port, "127.0.0.1", () => console.log(`telegram-mock-ready:${port}`));
