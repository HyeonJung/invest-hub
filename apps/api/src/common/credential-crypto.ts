import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

export function encryptCredentialSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptCredentialSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new Error("저장된 토스 API secret 형식이 올바르지 않습니다.");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function previewCredentialSecret(secret: string) {
  if (secret.length <= 4) return "****";
  return `${secret.slice(0, 2)}****${secret.slice(-2)}`;
}

function getKey() {
  const raw =
    process.env.CREDENTIAL_ENCRYPTION_SECRET ??
    process.env.TOSS_CREDENTIAL_SECRET ??
    process.env.SESSION_SECRET ??
    "invest-hub-local-dev-credential-secret";
  return createHash("sha256").update(raw).digest();
}
