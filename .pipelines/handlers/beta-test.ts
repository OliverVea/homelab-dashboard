import { implement } from "@olve/pipelines";
import { betaTest } from "../pipeline";
import { checkServesTree, serviceUrl } from "./lib/site";

export default implement(betaTest, async ({ source, release }, ctx) => {
  const tree = await ctx.files.fetch(source.tree);
  await checkServesTree(ctx, serviceUrl(release), tree);
});
