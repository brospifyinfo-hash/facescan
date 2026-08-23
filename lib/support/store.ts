// Throttling for the support form.
//
// WHY THIS EXISTS AT ALL
//
// The form is unauthenticated by design — somebody who cannot sign in is
// exactly the person who needs to reach support — so the only thing standing
// between it and an open mail relay is this counter. Without it the endpoint
// sends attacker-chosen text, from a verified domain, to a fixed inbox, as
// often as it is called: the inbox drowns and the sending domain's
// reputation goes with it.
//
// THREE BACKINGS, CHOSEN BY THE ENVIRONMENT — the same ladder as
// lib/auth/store.ts, and for the same reason. A per-instance Map does not
// throttle a serverless deployment: each cold start hands out a fresh
// allowance, so the real limit is (limit x number of warm instances), which
// is not a limit. Redis first, spreadsheet second, memory only when neither
// is configured so a bare checkout still runs.
//
// KEYED ON THE IP, NOT THE ADDRESS
//
// The address is attacker-supplied and free to vary; the source is not. An
// address-keyed counter is defeated by a "+1" suffix, which makes it a
// counter that only ever throttles honest users.

import { kv, kvConfigured } from "../kv";
import {
  skGetJson,
  skSetJson,
  sheetsKvConfigured,
  sheetsKvHealthy,
} from "../sheets-kv";

/** Four messages an hour is generous for a human and useless for a flood. */
export const MAX_SENDS_PER_WINDOW = 4;
export const SEND_WINDOW_MS = 60 * 60 * 1000;

export interface SupportThrottle {
  /** Timestamps inside the current window, oldest first. */
  sendsInWindow(key: string): Promise<number[]>;
  recordSend(key: string): Promise<void>;
}

const fresh = (timestamps: unknown): number[] => {
  if (!Array.isArray(timestamps)) return [];
  const cutoff = Date.now() - SEND_WINDOW_MS;
  return timestamps.filter(
    (t: unknown): t is number => typeof t === "number" && t > cutoff,
  );
};

class MemoryThrottle implements SupportThrottle {
  private sends = new Map<string, number[]>();

  async sendsInWindow(key: string) {
    const kept = fresh(this.sends.get(key));
    this.sends.set(key, kept);
    return kept;
  }
  async recordSend(key: string) {
    const kept = await this.sendsInWindow(key);
    kept.push(Date.now());
    this.sends.set(key, kept);
  }
}

class RedisThrottle implements SupportThrottle {
  private key = (id: string) => `support:${id}`;

  async sendsInWindow(id: string) {
    const raw = await kv("GET", this.key(id));
    if (typeof raw !== "string") return [];
    try {
      return fresh(JSON.parse(raw));
    } catch {
      // A corrupt counter must not lock anyone out of contacting support.
      // Treating it as empty costs at most a few extra messages.
      return [];
    }
  }

  async recordSend(id: string) {
    const timestamps = await this.sendsInWindow(id);
    timestamps.push(Date.now());
    await kv(
      "SET",
      this.key(id),
      JSON.stringify(timestamps),
      "PX",
      String(SEND_WINDOW_MS),
    );
  }
}

class SheetsThrottle implements SupportThrottle {
  private key = (id: string) => `support:${id}`;
  /** Same floor as the OTP store: a script one version behind must degrade
   *  to yesterday's behaviour, not to a hard outage. */
  private fallback = new MemoryThrottle();

  private async via<T>(remote: () => Promise<T>, local: () => Promise<T>) {
    if (!sheetsKvHealthy()) return local();
    try {
      return await remote();
    } catch {
      return local();
    }
  }

  async sendsInWindow(id: string) {
    return this.via(
      async () => fresh(await skGetJson<unknown>(this.key(id))),
      () => this.fallback.sendsInWindow(id),
    );
  }

  async recordSend(id: string) {
    return this.via(
      async () => {
        const timestamps = fresh(await skGetJson<unknown>(this.key(id)));
        timestamps.push(Date.now());
        await skSetJson(this.key(id), timestamps, SEND_WINDOW_MS);
      },
      () => this.fallback.recordSend(id),
    );
  }
}

// Pinned to globalThis for the same reason the OTP store is: Next.js loads
// route handlers in separate module graphs, and a module-level Map would
// give each one its own counter.
declare global {
  // eslint-disable-next-line no-var
  var __facescanSupportThrottle: SupportThrottle | undefined;
}

export const supportThrottle: SupportThrottle =
  globalThis.__facescanSupportThrottle ??
  (globalThis.__facescanSupportThrottle = kvConfigured()
    ? new RedisThrottle()
    : sheetsKvConfigured()
      ? new SheetsThrottle()
      : new MemoryThrottle());
