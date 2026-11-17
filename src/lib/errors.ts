import { ConvexError } from "convex/values";

/** Turns a Convex error into a message that is safe and useful to show users. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: unknown } | string;
    if (typeof data === "string") return data;
    if (data && typeof data.message === "string") return data.message;
  }
  return "Something went wrong. Please try again.";
}
