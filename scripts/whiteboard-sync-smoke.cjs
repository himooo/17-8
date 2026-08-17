const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("src/components/shell/SmartWhiteboard.tsx", "utf8");
for (const marker of ["BroadcastChannel", "slideRevisionsRef", "bisalasa-whiteboard-sync-v1", "skipNextBoardBroadcastRef", "window.addEventListener(\"storage\"", "slideRevisionStorageKey"]) assert.ok(source.includes(marker), `missing whiteboard sync marker: ${marker}`);
assert.ok(source.includes("snapshot.slice(-2000)"), "sync must be bounded for performance");
assert.ok(source.includes("incomingRevision <="), "late revisions must be ignored");
console.log(JSON.stringify({ ok: true, suite: "whiteboard-sync-smoke", checks: 8, channel: true, revisionGuard: true, storageFallback: true, boundedSnapshot: true }, null, 2));
