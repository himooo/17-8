const fs = require("node:fs");
const pageClient = fs.readFileSync("src/app/page-client.tsx", "utf8");
const rail = fs.readFileSync("src/components/shell/FloatingSideRail.tsx", "utf8");
if (!pageClient.includes("if (studentBroadcast)")) throw new Error("studentBroadcast branch missing");
const branch = pageClient.slice(pageClient.indexOf("if (studentBroadcast)"), pageClient.indexOf("return (", pageClient.indexOf("if (studentBroadcast)")) + 8);
if (branch.includes("SmartWhiteboard")) throw new Error("SmartWhiteboard must not be mounted in student broadcast");
for (const panel of ["ai", "notes", "reports", "settings", "moodle"]) {
  if (!rail.includes(`\"${panel}\"`)) throw new Error(`private panel missing: ${panel}`);
}
if (!pageClient.includes("IframeStage studentView")) throw new Error("student stage missing");
console.log(JSON.stringify({ ok: true, suite: "student-view-privacy-smoke", checks: 8 }));
