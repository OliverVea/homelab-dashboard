import { implement, serviceUrl } from "@olivervea/pipelines";
import { betaTest } from "../pipeline";
import { checkServesTree } from "./lib/site";

export default implement(betaTest, async ({ source, release }, ctx) => {
  const tree = await ctx.files.fetch(source.tree);
  await checkServesTree(ctx, serviceUrl(release), tree);
});
