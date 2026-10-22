import { join } from "node:path";
import { implement, serviceUrl } from "@olivervea/pipelines";
import { prodTest } from "../pipeline";
import { checkServesTree, ensure, readSite } from "./lib/site";

const HOST = "home-private.ovea.pro";
// Public DNS can resolve to another entrypoint from inside the cluster; pin the request to the node's ingress.
const INGRESS_IP = "192.168.11.8";

export default implement(prodTest, async ({ source, release }, ctx) => {
  const tree = await ctx.files.fetch(source.tree);
  await checkServesTree(ctx, serviceUrl(release), tree);

  const page = join(ctx.tmpDir, "ingress.html");
  await ctx.sh("apk add --no-cache curl");
  await ctx.exec(["curl", "-fsS", "--max-time", "30", "--resolve", `${HOST}:443:${INGRESS_IP}`, "-o", page, `https://${HOST}/`]);
  ensure((await ctx.readText(page)) === readSite(tree, "index.html"), `https://${HOST}/ is not this commit's page`);
  ctx.log("ingress serves this commit's page", { url: `https://${HOST}/` });
});
