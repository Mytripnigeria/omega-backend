/**
 * A storage backend. `StorageService` owns the `files` table and the public
 * API; a driver owns nothing but the bytes — putting an object somewhere
 * public and taking it away again.
 *
 * Drivers are addressed by `name`, which is recorded on every uploaded file so
 * objects written by one backend can still be deleted after the active driver
 * has been switched to another.
 */
export type StorageDriverName = 'r2' | 'cloudinary';

export interface PutInput {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  /** Normalised folder, no leading/trailing slashes. */
  folder: string;
}

export interface PutResult {
  /** Backend-specific object identifier, stored as `files.key`. */
  key: string;
  /** Public URL the object is served from. */
  url: string;
  /** Merged into `files.metadata`; must carry whatever `remove` needs. */
  metadata?: Record<string, unknown>;
}

export interface StorageDriver {
  readonly name: StorageDriverName;
  /** Env var names this driver needs but does not have. Empty when usable. */
  missingConfig(): string[];
  put(input: PutInput): Promise<PutResult>;
  /** Must resolve (not throw) when the object is already gone. */
  remove(key: string, metadata: Record<string, unknown> | null): Promise<void>;
}
