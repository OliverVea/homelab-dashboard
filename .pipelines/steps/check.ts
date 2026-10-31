import { existsSync } from "node:fs";
import { join } from "node:path";
import { implement, step, Source } from "@olivervea/pipelines";
import { BETA_SET } from "../shared";
import { PAGE, ensure, localFiles, readSite } from "../lib/site";

export const check = implement(step({
  name: "check",
  description: "Checks every local link in the page exists, then lints the chart (`helm lint --strict`) with the beta and prod settings.",
  image: "alpine:3.22",
  input: { source: Source },
  timeoutSeconds: 300,
}), async ({ source }, ctx) => {
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
