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

- **Declared in the GitOps config** — a `url:` field on a step in `.pipelines/config.yaml`. Simple,
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
.pipelines/       build (Kaniko) -> deploy -> verify
```

## Editing it

Edit `site/index.html`, commit, push. The pipeline rebuilds and redeploys; the reconcile poll picks
the change up within ~5 minutes, or force it with `pl binding reconcile <pipelineId>`.

## CD

| Step | Does | Fails when |
|---|---|---|
| **build** | Kaniko builds the nginx image to a tar, stages the chart and version into the ArtifactBundle | the Dockerfile or `site/index.html` is missing, or the build fails |
| **deploy** | imports the image tar into the node's k3s containerd, `helm upgrade --install` | the import or the rollout fails |
| **verify** | `kubectl rollout status`, then fetches the real URL through the ingress and asserts it is **this** page, not a stray 200 | the site does not answer, or answers with someone else's content |

The image is never pushed to a registry — it is imported straight into the node's containerd, which
is why the chart sets `pullPolicy: Never`.

## A public repo still wants a GitHub token

Counter-intuitive, and it cost a debugging cycle here: binding a pipeline to a **public** repo with
no credentials secret works, right up until GitHub's **anonymous API rate limit** (60 requests per
hour, per IP) runs out. Then:

- **the reconcile fails**, not the build: `GitHub returned 403 fetching blob
  '.pipelines/scripts/verify.sh'`. The pipeline keeps running the **last config it successfully
  fetched**, so pushing a fix changes nothing and the same failure repeats — which reads exactly
  like "my fix didn't work" rather than "the server never saw my fix". Check
  `pl binding status <id>` before re-debugging a script.
- the build fails too, but with a *different* error: `olve_fetch_repo` always sends
  `Authorization: token $GITHUB_TOKEN`, and an empty token is a **401**, not anonymous access.

So set `GITHUB_TOKEN` and bind with `--credentials-secret GITHUB_TOKEN` even for a public repo. It
is not about access, it is about the rate limit — an authenticated token gets 5000 requests/hour.
