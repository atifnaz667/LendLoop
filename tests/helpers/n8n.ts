import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * Runs an n8n Code node body (n8n/code/*.js) the way n8n does: as an async
 * function with $env, $input, $json, $getWorkflowStaticData, $() and
 * this.helpers in scope. Lets us prove the n8n side and the Convex side agree
 * on signatures without a running n8n.
 */
const nodeRequire = createRequire(import.meta.url);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export interface CodeNodeContext {
  env?: Record<string, string | undefined>;
  items?: { json: Record<string, unknown>; binary?: Record<string, unknown> }[];
  json?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  rawBody?: string;
  nodes?: Record<string, { item: { json: Record<string, unknown> } }>;
}

export async function runCodeNode(file: string, ctx: CodeNodeContext = {}) {
  const code = readFileSync(join(process.cwd(), "n8n/code", `${file}.js`), "utf8");
  const items = ctx.items ?? [];
  const staticData = ctx.staticData ?? {};
  const fn = new AsyncFunction(
    "require",
    "$env",
    "$input",
    "$json",
    "$getWorkflowStaticData",
    "$",
    code,
  );
  const helpers = {
    getBinaryDataBuffer: async () => {
      if (ctx.rawBody === undefined) throw new Error("no binary data");
      return Buffer.from(ctx.rawBody, "utf8");
    },
  };
  return fn.call(
    { helpers },
    nodeRequire,
    ctx.env ?? {},
    { first: () => items[0], all: () => items },
    ctx.json ?? items[0]?.json ?? {},
    () => staticData,
    (name: string) => {
      const node = ctx.nodes?.[name];
      if (!node) throw new Error(`Unknown node ${name}`);
      return { ...node, first: () => node.item };
    },
  ) as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
