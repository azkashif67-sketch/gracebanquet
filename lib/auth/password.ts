import "server-only";
import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  return verify(hashStr, password, ARGON2_OPTIONS);
}

// A fixed, precomputed hash used to run a dummy verify when a username isn't
// found, so login takes the same amount of time either way and doesn't leak
// which usernames exist via response timing.
let dummyHashPromise: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("dummy-password-for-timing-safety");
  return dummyHashPromise;
}
