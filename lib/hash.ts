import { createHash } from "crypto";

const SALT = "saelim-erp-2026";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + SALT).digest("hex");
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}
