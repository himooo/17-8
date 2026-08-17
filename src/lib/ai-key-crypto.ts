import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";

function keyFilePath() {
  const configured = process.env.BISALASA_AI_KEY_SECRET_FILE?.trim();
  if (configured) return path.resolve(configured);

  // Keep the local encryption key beside the persistent SQLite database rather
  // than inside .next/standalone, which may be replaced on every build.
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl?.startsWith("file:")) {
    const rawPath = databaseUrl.slice("file:".length).split("?")[0];
    if (rawPath) {
      const databasePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
      return path.join(path.dirname(databasePath), ".ai-key-secret");
    }
  }

  const dataDir = process.env.BISALASA_DATA_DIR?.trim();
  return path.join(dataDir ? path.resolve(dataDir) : path.join(process.cwd(), "data"), ".ai-key-secret");
}
const VERSION = "v1";

async function getSecret(): Promise<Buffer> {
  const fromEnv = process.env.BISALASA_AI_KEY_SECRET;
  if (fromEnv) {
    return crypto.createHash("sha256").update(fromEnv, "utf8").digest();
  }

  const keyFile = keyFilePath();
  await fs.mkdir(path.dirname(keyFile), { recursive: true });
  try {
    const existing = (await fs.readFile(keyFile, "utf8")).trim();
    if (existing.length >= 64) return Buffer.from(existing, "hex");
  } catch {
    // First run: create a local secret below.
  }

  const secret = crypto.randomBytes(32);
  await fs.writeFile(keyFile, secret.toString("hex"), { encoding: "utf8", mode: 0o600 });
  try { await fs.chmod(keyFile, 0o600); } catch {}
  return secret;
}

export async function encryptAiKey(value: string): Promise<string> {
  const secret = await getSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export async function decryptAiKey(payload: string): Promise<string> {
  const [version, ivText, tagText, encryptedText] = payload.split(".");
  if (version !== VERSION || !ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted AI key format");
  }
  const secret = await getSecret();
  const decipher = crypto.createDecipheriv(ALGORITHM, secret, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function maskAiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}
