// Calling the backend: Tauri's invoke, with what a failed command gives back as an AppError.
import { invoke as tauriInvoke, type InvokeArgs, type InvokeOptions } from "@tauri-apps/api/core";
import type { ErrorKind, Failure } from "./generated";
export type { ErrorKind, Failure };

/**
 * A command that failed: its message, worded for the person using the app, and the kind of
 * failure it is when the app knows, to explain it and offer the fix. It reads as its
 * message, so `String(error)` and `${error}` show just that.
 */
export class AppError extends Error {
  readonly kind: ErrorKind | null;

  constructor(message: string, kind: ErrorKind | null = null) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
  }

  override toString(): string {
    return this.message;
  }
}

function isFailure(value: unknown): value is Failure {
  return typeof value === "object" && value !== null && typeof (value as Failure).message === "string";
}

/** What a command (or anything else) failed with, as an AppError. */
export function asAppError(reason: unknown): AppError {
  if (reason instanceof AppError) return reason;
  if (isFailure(reason)) return new AppError(reason.message, reason.kind ?? null);
  if (reason instanceof Error) return new AppError(reason.message);
  return new AppError(String(reason));
}

/** The kind of failure `error` is, when it came from a command and the app knows it. */
export function errorKind(error: unknown): ErrorKind | null {
  return error instanceof AppError ? error.kind : null;
}

/** Run a backend command; a failure rejects with an AppError. */
export async function invoke<T>(command: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args, options);
  } catch (reason) {
    throw asAppError(reason);
  }
}
