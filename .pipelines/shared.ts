import { secret } from "@olivervea/pipelines";

export const GITHUB_TOKEN = secret("GITHUB_TOKEN", "GitHub read token used to fetch the repo tarball.");
export const SSH_PRIVATE_KEY = secret("SSH_PRIVATE_KEY", "SSH key for importing the image and running helm on the homelab host.");
// Beta has no ingress: no DNS record or certificate, it is tested through its Service.
export const BETA_SET = { "ingress.enabled": "false" };
// kaniko under gVisor stalls pulling from these registries directly.
export const REGISTRY_MAP = { "mcr.microsoft.com": "mcr-cache.ovea.pro", "index.docker.io": "hub-cache.ovea.pro" };
