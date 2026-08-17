import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const KEY_FILE = path.join(process.cwd(), "data", ".moodle-key-secret");
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

async function getSecret(): Promise<Buffer> {
  const fromEnv = process.env.BISALASA_MOODLE_KEY_SECRET;
  if (fromEnv) return crypto.createHash("sha256").update(fromEnv, "utf8").digest();
  await fs.mkdir(path.dirname(KEY_FILE), { recursive: true });
  try {
    const existing = (await fs.readFile(KEY_FILE, "utf8")).trim();
    if (existing.length >= 64) return Buffer.from(existing, "hex");
  } catch {}
  const secret = crypto.randomBytes(32);
  await fs.writeFile(KEY_FILE, secret.toString("hex"), { encoding: "utf8", mode: 0o600 });
  try { await fs.chmod(KEY_FILE, 0o600); } catch {}
  return secret;
}

export async function encryptMoodleToken(value: string): Promise<string> {
  const secret = await getSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export async function decryptMoodleToken(payload: string): Promise<string> {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new Error("Invalid encrypted Moodle token format");
  const [version, ivText, tagText, encryptedText] = parts;
  if (version !== VERSION || !ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted Moodle token format");
  const secret = await getSecret();
  const decipher = crypto.createDecipheriv(ALGORITHM, secret, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
