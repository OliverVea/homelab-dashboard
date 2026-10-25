# homelab-dashboard

One static page listing the URLs of everything running on the homelab. No JavaScript, no
framework, no database — an nginx image with an `index.html` and a `style.css` in it.

Live at **<https://home-private.ovea.pro>**.

## Why this is deliberately dumb

The brief was "super simple", and there is a real reason to keep it that way: **this page is a
stopgap, and it should not become an institution.**

The links are hand-maintained. That means they are wrong the moment a service moves, gets renamed,
or is added by a pipeline that this repo has never heard of. A dashboard that lies is worse than no
dashboard, and the fix is not to add a service-discovery backend to a static page — it is to move
the information to where it is already known.

**The right place is Olve.Pipelines.** Every service here is deployed by a pipeline, and that
pipeline already knows where it put the thing. Two shapes that would work:

- **Declared in the GitOps config** — a `url` on a step in `.pipelines/pipeline.ts`. Simple,
  reviewable, versioned with the deployment that owns it. Wrong only if someone forgets to update
  it, which is the same failure mode as here, but at least it lives next to the deploy.
- **Part of a step's result** — the deploy step *reports* the URL it deployed to, the way it
  already reports success or failure. Harder, but self-maintaining: a URL that comes out of the
  deploy cannot drift from the deploy.

Either way, Olve.Pipelines would then be able to render this list itself, and this repo could be
deleted. That is the goal. Until then, this page exists so the URLs are in one place.

## Structure

```
site/index.html   the page
site/style.css    the styles
Dockerfile        nginx:alpine + COPY site/
helm/             chart: Deployment, Service, Ingress
.pipelines/       CD on Olve.Pipelines v2 (pipeline.ts)
```

## Editing it

Edit `site/index.html`, commit, push to `main`. The push goes all the way to prod on its own: the
v2 deploy poll picks it up within ~15 minutes, or force it with
`pl binding reconcile homelab-dashboard`.

## CD

Pipeline `homelab-dashboard` on Olve.Pipelines v2 prod (`.pipelines/pipeline.ts`). Every push to
`main`:

| Stage | Steps | Fails when |
|---|---|---|
| 1 | **source** (fetch the commit) | GitHub can't be reached |
| 2 | **build** (kaniko builds the nginx image) ∥ **check** (every local link in the page exists, `helm lint --strict` with beta and prod settings) | the image doesn't build, a linked file is missing, the chart doesn't lint |
| 3 | **deploy-beta**: imports the image into the node's k3s containerd, `helm upgrade --install` into `apps-beta` (no ingress) | the import or rollout fails |
| 4 | **beta-test**: beta's Service serves this commit's `index.html` and every file it links, byte for byte | beta serves anything else |
| 5 | **deploy-prod**: the same image into `apps` | the import or rollout fails |
| 6 | **prod-test** (read-only): the same check against prod's Service, then `https://home-private.ovea.pro/` through the ingress (pinned to the node's IP, TLS verified) | prod or the ingress serves anything else |

There is no test suite: the page is static, so the checks prove the right files are served.

The image is never pushed to a registry — it is imported straight into the node's containerd, which
is why the chart sets `pullPolicy: Never`.

To stop deploys, block `deploy-beta` and `deploy-prod` (`pl step block`). A run with
`deployTo=beta` stops after beta-test.

## A public repo still wants a GitHub token

Binding a pipeline to a **public** repo without a token works until GitHub's **anonymous API rate
limit** (60 requests per hour, per IP, shared by every binding) runs out; then reconciles and source
fetches fail with 403s. The pipeline keeps the last config it fetched, so a pushed fix seems to do
nothing — check `pl binding status` before re-debugging a step. So the pipeline has a
`GITHUB_TOKEN` secret, named as the binding's credentials key, even though the repo is public.
