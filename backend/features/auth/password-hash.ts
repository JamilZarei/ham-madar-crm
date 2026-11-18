import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const options = { N: 65_536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const prefix = "scrypt-v1";
const keyLength = 64;
const record = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

export const passwordInput = z.string("رمز عبور را وارد کنید.").min(1, "رمز عبور را وارد کنید.").max(256, "رمز عبور بیش از حد طولانی است.");
export const newPassword = passwordInput.refine((value) => {
  const length = Array.from(value).length;
  return length >= 15 && length <= 128;
}, "رمز عبور باید ۱۵ تا ۱۲۸ نویسه داشته باشد.");

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return [prefix, salt.toString("hex"), key.toString("hex")].join("$");
}

export async function passwordMatches(password: string, stored?: string | null) {
  const match = stored?.match(record);
  const key = await derive(password, match ? Buffer.from(match[1], "hex") : Buffer.alloc(16));
  return !!match && timingSafeEqual(key, Buffer.from(match[2], "hex"));
}
