import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "@olivervea/pipelines";

export const PAGE = "site/index.html";

export function ensure(ok: boolean, what: string): asserts ok {
  if (!ok) throw new Error(what);
}

export const readSite = (tree: string, path: string) => readFileSync(join(tree, "site", path), "utf8");

// Same-origin hrefs and srcs (`/style.css`), as paths under site/.
export function localFiles(html: string): string[] {
  const refs = [...html.matchAll(/(?:href|src)="\/([^"/][^"]*)"/g)].map(m => m[1]!);
  return ["index.html", ...new Set(refs)];
}

// Proves the deployment runs this commit: every file is served byte for byte as in the tree.
export async function checkServesTree(ctx: Ctx, url: string, tree: string) {
  for (const path of localFiles(readSite(tree, "index.html"))) {
    const response = await ctx.http.expectOk(`${url}/${path === "index.html" ? "" : path}`);
    ensure((await response.text()) === readSite(tree, path), `${url}/${path} is not this commit's ${path}`);
  }
  ctx.log("serves this commit's site", { url });
}
