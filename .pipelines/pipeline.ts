// Every push goes beta, then prod. config.yaml beside it is the paused v1 deployer's rollback path.
import { pipeline, secret, step, steps, HelmRelease, Source } from "@olve/pipelines";
import * as M from "./models";

export const GITHUB_TOKEN = secret("GITHUB_TOKEN", "GitHub read token used to fetch the repo tarball.");
export const SSH_PRIVATE_KEY = secret("SSH_PRIVATE_KEY", "SSH key for importing the image and running helm on the homelab host.");

export const MIRROR = "registry.ovea.pro/olve-pipelines-v2/mirror";
// Beta has no ingress: no DNS record or certificate, it is tested through its Service.
export const BETA_SET = { "ingress.enabled": "false" };

export const source = steps.gitHubSource({
  name: "source",
  description: "Fetches the pushed commit from GitHub.",
  token: GITHUB_TOKEN,
});

export const mirrorBaseImages = step({
  name: "mirror-base-images",
  description: "Copies the Dockerfile's base image into registry.ovea.pro; kaniko under gVisor can stall pulling upstream.",
  image: "gcr.io/go-containerregistry/crane:debug",
  timeoutSeconds: 600,
});

export const build = steps.imageBuild({
  name: "build",
  description: "Builds the nginx image with the page baked in, with kaniko.",
  repository: "homelab-dashboard",
  registryMap: { "index.docker.io": `${MIRROR}/docker.io` },
  timeoutSeconds: 900,
});

export const check = step({
  name: "check",
  description: "Checks every local link in the page exists, then lints the chart (`helm lint --strict`) with the beta and prod settings.",
  image: "alpine:3.22",
  input: { source: Source },
  timeoutSeconds: 300,
});

export const deployBeta = steps.helmDeployOverSsh({
  name: "deploy-beta",
  description: "Deploys the image to apps-beta with Helm, without an ingress, and checks it serves.",
  host: "oliver@bulwark-m2",
  sshKey: SSH_PRIVATE_KEY,
  release: "homelab-dashboard",
  namespace: "apps-beta",
  chart: "helm",
  set: BETA_SET,
  healthUrl: "http://homelab-dashboard.apps-beta.svc.cluster.local/",
  timeoutSeconds: 600,
});

export const betaTest = step({
  name: "beta-test",
  description: "Checks beta serves exactly this commit's page and every local file it links.",
  image: "alpine:3.22",
  input: { source: Source, release: HelmRelease },
  timeoutSeconds: 180,
});

export const deployProd = steps.helmDeployOverSsh({
  name: "deploy-prod",
  description: "Deploys the image to apps with Helm and checks it serves.",
  host: "oliver@bulwark-m2",
  sshKey: SSH_PRIVATE_KEY,
  release: "homelab-dashboard",
  namespace: "apps",
  chart: "helm",
  healthUrl: "http://homelab-dashboard.apps.svc.cluster.local/",
  timeoutSeconds: 600,
});

export const prodTest = step({
  name: "prod-test",
  description: "Read-only: prod serves this commit's page, through its Service and through the ingress at home-private.ovea.pro.",
  image: "alpine:3.22",
  input: { source: Source, release: HelmRelease },
  timeoutSeconds: 180,
});

export default pipeline({
  name: "homelab-dashboard",
  description: "Build the nginx image with kaniko and check the page and chart, deploy to apps-beta and check it serves this commit, then deploy the same image to apps and check it through the ingress. deployTo=beta stops after beta.",
  input: M.DeployRequest,
})
  .onPush(e => ({ repo: e.repository.full_name, sha: e.after, deployTo: "prod" }))
  .stage([source, from => ({ repo: from.input.repo, sha: from.input.sha })], mirrorBaseImages)
  .stage(build, check)
  .stage(deployBeta)
  .stage(betaTest)
  .when({ deployTo: "prod" }, p => p
    .stage(deployProd)
    .stage([prodTest, from => ({ source: from.source, release: from["deploy-prod"] })]));
