import { ConvexError } from "convex/values";

export type AppErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT";

/**
 * Expected business error. Built on ConvexError so the code and message reach
 * the client intact (plain Errors are redacted in production), while internal
 * details such as stack traces stay on the server.
 */
export class AppError extends ConvexError<{ code: AppErrorCode; message: string }> {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super({ code, message });
    this.code = code;
  }
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in to continue.");
export const forbidden = (message = "You don't have permission to do that.") =>
  new AppError("FORBIDDEN", message);
export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found.`);
export const validation = (message: string) => new AppError("VALIDATION", message);
export const conflict = (message: string) => new AppError("CONFLICT", message);
