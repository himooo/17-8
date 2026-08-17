import { strict as assert } from "node:assert";
import { encryptMoodleToken, decryptMoodleToken } from "../src/lib/moodle-crypto.ts";

const token = "moodle-secret-token-✓";
const encrypted = await encryptMoodleToken(token);
assert.notEqual(encrypted, token);
assert.ok(!encrypted.includes(token));
assert.equal(await decryptMoodleToken(encrypted), token);
let failed = false;
try { await decryptMoodleToken(`${encrypted}.tampered`); } catch { failed = true; }
assert.equal(failed, true);
console.log(JSON.stringify({ passed: 4, failed: 0, encryptedHasPlaintext: encrypted.includes(token) }));
