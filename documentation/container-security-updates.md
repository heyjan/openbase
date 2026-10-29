# Container security updates

## Scope

The application tracks the moving `node:24-slim` tag for both build and runtime.
The development container tracks Node 24 Bookworm. The AI service tracks
`python:3.12-slim`. Do not replace these with exact patch tags or `node:latest`.

Moving tags do not change existing images or running containers. Every release
must pull fresh base images, rebuild, verify, scan, and deploy. Compose build
settings request both fresh base images and uncached layers. Direct builds and
external CI pipelines must use `--pull --no-cache` explicitly. Schedule regular
rebuilds in the deployment system as well as rebuilds for urgent advisories.
This repository does not currently have a scheduled image-publishing pipeline.

## eMudhra / emSign certificate incident

Sources:

- [Python security announcement](https://discuss.python.org/t/information-for-python-users-regarding-emudhra-emsign-ca-certificate-security-incident/109576)
- [certifi advisory GHSA-6q48-6c7w-9gw2](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2)
- [pip 26.2.2 release](https://pypi.org/project/pip/26.2.2/)

Compromised intermediate CA keys can allow TLS impersonation. Updating only the
OS certificate store does not fix upstream pip's vendored certificate bundle.
For the AI service, the required minimum versions are:

| Component | Minimum |
| --- | --- |
| Python on the 3.12 branch | 3.12.16 |
| pip | 26.2.2 |
| certifi | 2026.10.19 |

The Dockerfile checks the interpreter version, refreshes the OS certificate and
OpenSSL packages, then bootstraps pip from the announcement's SHA-256-verified
26.2.2 wheel before resolving other packages. Subsequent installs may upgrade
pip further. The certifi floor applies to the application's Python dependencies.
`security_check.py` checks the resulting interpreter and package versions during
image construction and can also run inside a deployed AI container.

The advisory recommends 2026.10.19 rather than 2026.10.18 for compatibility with
unaffected emSign certificates. Do not blanket-delete every emSign certificate,
disable TLS verification, or use `--trusted-host` as a workaround.

Build without layer caching so old pip installs, Python dependencies and OS
certificate packages cannot remain in reused layers. If the moving Python image
has not received the interpreter mitigation, the build fails rather than
publishing an image below the required version.

The development container installs Debian's Python and pip through apt. Debian
may backport fixes without using the upstream version numbers above. Refresh its
base image and apt packages, check the distribution's security status, and
recreate the development container. Existing virtual environments and other
containers are separate installations and need their own updates. Do not assume
rebuilding the AI service updates those environments.

## LiteLLM

The AI service uses `pydantic-ai-slim[openai,anthropic]` directly. LiteLLM is not a
declared application dependency. `ai_service/constraints.txt` excludes all
LiteLLM versions with an unsatisfiable constraint. Pip fails dependency resolution
if a future dependency tries to add it. The image's security check also rejects
an installed distribution named LiteLLM.

This is a dependency exclusion, not a vulnerability scan or a guarantee about
remote AI gateways. A LiteLLM proxy configured outside this repository needs its
own inventory and review. If a previously deployed environment contained a
compromised package, rebuilding alone does not address potential credential
exposure; investigate that deployment and rotate affected credentials.

## Build and verification

Run in the Podman environment from the repository root:

```bash
podman compose down
podman compose build --pull --no-cache
podman compose up -d
podman compose exec app node --version
podman compose exec ai python security_check.py
podman compose exec ai python -m pip check
podman compose exec ai python -m pip list
podman compose exec app pnpm audit --audit-level high
```

Also build the production Node Dockerfile, which differs from the development
container used by Compose:

```bash
podman build --pull=always --no-cache -t openbase-security-check .
podman run --rm --entrypoint node openbase-security-check --version
```

Run the security guard's regression tests inside the AI image:

```bash
podman run --rm \
  -v "$(pwd)/ai_service/tests:/app/tests:ro,z" \
  --entrypoint python localhost/openbase-ai \
  -m unittest discover -s tests -v
```

Replace `localhost/openbase-ai` with the AI image name produced by your Compose
provider, or build it explicitly with
`podman build --pull=always --no-cache -t openbase-ai ai_service` first.

Run your container vulnerability scanner against both final production images.
`pip check` verifies dependency compatibility, not vulnerability status. The
incident-specific security guard does not replace a Python dependency audit or
an OS/container scan. Verify login, dashboard queries and an AI request after
redeployment. No provider API keys are needed for the image build itself.

For AWS deployment and Docker Hub publishing, follow
[the deployment runbook](DEPLOYMENT.md). Keep a previous application image tag
for rollback, but do not roll back to a known-vulnerable image without explicitly
assessing that risk.
