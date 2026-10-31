import { implement, serviceUrl, step, HelmRelease, Source } from "@olivervea/pipelines";
import { checkServesTree } from "../lib/site";

export const betaTest = implement(step({
  name: "beta-test",
  description: "Checks beta serves exactly this commit's page and every local file it links.",
  image: "alpine:3.22",
  input: { source: Source, release: HelmRelease },
  timeoutSeconds: 180,
}), async ({ source, release }, ctx) => {
  const tree = await ctx.files.fetch(source.tree);
  await checkServesTree(ctx, serviceUrl(release), tree);
});
