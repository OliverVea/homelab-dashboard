import { model, z } from "@olivervea/pipelines";

export const DeployRequest = model("DeployRequest", z.object({
  repo: z.string().default("OliverVea/homelab-dashboard"),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  deployTo: z.enum(["beta", "prod"]).default("prod"),
}));
