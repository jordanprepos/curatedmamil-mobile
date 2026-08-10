/**
 * Bounded waits for Firestore writes.
 *
 * Firestore applies a write to its local cache straight away, but the promise
 * `addDoc`/`setDoc`/`updateDoc` return only settles once the *server* has
 * acknowledged it. When the SDK can't reach the backend that promise never
 * settles at all — it neither resolves nor rejects — so a screen that awaits it
 * leaves its `busy` flag stuck on: the button greys out, no error is thrown, and
 * the tap looks like it did nothing.
 *
 * Racing the write against a timer turns that silent hang into a message the
 * owner can act on. The write itself is untouched: it stays queued inside the
 * SDK and still lands if the connection comes back.
 */

export const WRITE_TIMEOUT_MS = 12_000;

export class WriteTimeout extends Error {
  constructor() {
    super('Firestore did not acknowledge the write in time');
    this.name = 'WriteTimeout';
  }
}

export async function withWriteTimeout<T>(
  work: Promise<T>,
  ms: number = WRITE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WriteTimeout()), ms);
  });

  try {
    // Promise.race keeps a handler attached to `work`, so a late rejection
    // after a timeout is still consumed rather than surfacing as unhandled.
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

/** Indonesian copy for a failed write, shown inline on the screens. */
export function writeErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof WriteTimeout) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi Anda, lalu coba lagi.';
  }

  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'Tidak punya izin menyimpan perubahan.';
  if (code === 'unavailable') return 'Server tidak dapat dijangkau. Coba lagi.';
  return fallback;
}
