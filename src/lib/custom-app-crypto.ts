import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const KEY_FILE = path.join(process.cwd(), "data", ".custom-app-key");

async function getKey() {
  await fs.mkdir(path.dirname(KEY_FILE), { recursive: true });
  try {
    const current = await fs.readFile(KEY_FILE, "utf8");
    if (/^[a-f0-9]{64}$/i.test(current.trim())) return Buffer.from(current.trim(), "hex");
  } catch {}
  const key = crypto.randomBytes(32);
  await fs.writeFile(KEY_FILE, key.toString("hex"), { encoding: "utf8", mode: 0o600 });
  try { await fs.chmod(KEY_FILE, 0o600); } catch {}
  return key;
}

export async function encryptCustomAppToken(value: string) {
  if (!value.trim()) throw new Error("Custom App token is empty");
  const key = await getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export async function decryptCustomAppToken(payload: string) {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION || !parts[1] || !parts[2] || !parts[3]) throw new Error("Invalid encrypted Custom App token format");
  const key = await getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(parts[1], "base64url"));
  decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}
