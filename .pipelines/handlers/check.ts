import { existsSync } from "node:fs";
import { join } from "node:path";
import { implement } from "@olve/pipelines";
import { BETA_SET, check } from "../pipeline";
import { PAGE, ensure, localFiles, readSite } from "./lib/site";

export default implement(check, async ({ source }, ctx) => {
  const tree = await ctx.files.fetch(source.tree);
  const html = readSite(tree, "index.html");
  ensure(html.includes("<title>homelab</title>"), `${PAGE} has no homelab title`);
  const missing = localFiles(html).filter(path => !existsSync(join(tree, "site", path)));
  ensure(missing.length === 0, `${PAGE} links missing files: ${missing.join(", ")}`);

  await ctx.sh("apk add --no-cache helm");
  const betaFlags = Object.entries(BETA_SET).flatMap(([k, v]) => ["--set", `${k}=${v}`]);
  for (const flags of [[], betaFlags]) {
    await ctx.exec(["helm", "lint", "--strict", "helm", ...flags], { cwd: tree });
  }
  ctx.log("page and chart are fine");
});
