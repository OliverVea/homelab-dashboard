// Every push goes beta, then prod.
import { pipeline, steps } from "@olivervea/pipelines";
import * as M from "./models";
import { BETA_SET, GITHUB_TOKEN, REGISTRY_MAP, SSH_PRIVATE_KEY } from "./shared";
import { betaTest } from "./steps/beta-test";
import { check } from "./steps/check";
import { prodTest } from "./steps/prod-test";

const source = steps.gitHubSource({
  name: "source",
  description: "Fetches the pushed commit from GitHub.",
  token: GITHUB_TOKEN,
});

const build = steps.imageBuild({
  name: "build",
  description: "Builds the nginx image with the page baked in, with kaniko.",
  repository: "homelab-dashboard",
  registryMap: REGISTRY_MAP,
  timeoutSeconds: 900,
});

const deployBeta = steps.helmDeployOverSsh({
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

const deployProd = steps.helmDeployOverSsh({
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

export default pipeline({
  name: "homelab-dashboard",
  description: "Build the nginx image with kaniko and check the page and chart, deploy to apps-beta and check it serves this commit, then deploy the same image to apps and check it through the ingress. deployTo=beta stops after beta.",
  input: M.DeployRequest,
})
  .onPush(e => ({ repo: e.repository.full_name, sha: e.after, deployTo: "prod" }))
  .stage([source, from => ({ repo: from.input.repo, sha: from.input.sha })])
  .stage(build, check)
  .stage(deployBeta)
  .stage(betaTest)
  .when({ deployTo: "prod" }, p => p
    .stage(deployProd)
    .stage([prodTest, from => ({ source: from.source, release: from["deploy-prod"] })]));
