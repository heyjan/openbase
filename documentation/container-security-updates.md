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

## JavaScript dependency refresh

The security branch updates all direct JavaScript dependencies to the registry's
latest stable releases, including these major changes:

| Package | Previous | Updated |
| --- | --- | --- |
| pnpm | 11.13.1 | 12.16.1 |
| Nuxt | 4.4.8 | 4.6.3 |
| Nuxt UI | 4.10.0 | 4.12.0 |
| Vue | 3.5.28 | 3.5.44 |
| AI SDK | 5.0.155 | 7.0.155 |
| AI SDK Vue | 2.0.155 | 4.0.155 |
| ECharts | 5.6.0 | 6.1.0 |
| Vue ECharts | 7.0.3 | 8.3.2 |
| GridStack | 12.4.2 | 14.0.0 |
| better-sqlite3 | 12.11.1 | 13.0.3 |
| Nodemailer | 9.0.3 | 10.2.1 |
| Playwright | 1.58.2 in the old lockfile | 1.64.1 |

Use a current Node 24 image. Nuxt and the updated native build tool require at
least Node 24.15.0 on this branch. The package manifest declares that minimum
within Node 24; it does not pin an exact patch. pnpm remains pinned to the selected
release in `packageManager` for consistent lockfile handling.

The deprecated `lucide-vue-next` package is replaced by `@lucide/vue` 1.64.0.
All existing icon imports retain their exported names. GridStack's `float: true`
option becomes `mode: 'float'`, and its stylesheet now comes from the installed
package instead of a vendored version 12 copy. Nodemailer now supplies its own
TypeScript declarations, so the separate declaration package is removed.
ECharts 6 changes default styling; chart and PDF visual checks are required.
No application code currently imports the JavaScript AI SDK packages directly.
The root `.dockerignore` excludes host `node_modules` and generated Nuxt output
so `COPY . .` cannot overwrite freshly installed container dependencies with old
laptop artifacts. It also excludes runtime environment secrets and local databases.

Obsolete broad overrides, including the forced Vite 7 version, are removed so
Nuxt can resolve its supported Vite 8 dependency. One targeted override remains:
DuckDB's `node-gyp` is upgraded to 13.1.0 to remove its old tar 6 dependency.
The old `package.json` overrides entry was not in pnpm's workspace configuration.

The initial Fontless-to-esbuild 0.28 override was removed after review because
Fontless 0.2 declares esbuild `^0.27.0`. Nuxt UI 4.12 still declares
`@nuxt/fonts ^0.14.0`, which in turn declares Fontless `^0.2.1`. Forcing newer
Fontless or Nuxt Fonts majors would move the compatibility risk to another package.
Keep their declared ranges until the parent packages support an upgrade.

The pnpm release-age exclusion is scoped to the explicit Lucide release selected
for this migration, rather than disabling the supply-chain checks globally.

The lockfile audit after this refresh reports no critical, high or moderate
findings and two low-severity advisories:

- [deepmerge GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
  affects the paths through google-fonts-helper and Rollup's node-resolve plugin.
  The advisory lists no published patched version.
- [esbuild GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
  affects Fontless's esbuild 0.27.7. The fix is in 0.28.1+, outside Fontless's
  declared range. It concerns arbitrary file reads through esbuild's development
  server on Windows. Inspection of Fontless 0.2.1's published source shows that
  it imports only `transform` from esbuild to minify CSS, not the server API.
  Nuxt UI's automatic font integration is also disabled by `ui.fonts: false`.
  This is a dependency-path assessment, not a proof of runtime safety. Reassess
  if font settings change or esbuild's server is introduced.

Neither finding is suppressed. Do not treat this as a clean vulnerability scan,
force an unsupported dependency major without validation, or downgrade to an old
release solely to hide a finding. Recheck the advisories when upgrading the parent
packages.

Package resolution, `pnpm outdated`, the audit gate and static diff checks were
run for this refresh. Container builds, regression tests and UI checks remain
pending because Podman was unavailable in the editing environment. The version
listed in `packageManager` has not yet been validated by a full application build.

## Chart upgrade review and required runtime checks

The published [Vue ECharts 8 migration notes](https://github.com/ecomfe/vue-echarts#migration-to-v8)
list removal of Vue 2 support, legacy browser compatibility and the `/csp` entry
point. Openbase uses Vue 3, Chromium for E2E tests, and the standard `vue-echarts`
entry. Its existing `option`, `autoresize`, `loading` and `init-options` props
remain documented in 8.3.2. No required wrapper API migration was identified.
That contract review does not verify resize, reactive updates or tooltip behavior
in the browser.

The [ECharts 6 upgrade guide](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/)
documents new theme defaults, legend positioning, axis overflow prevention and
rich-text inheritance. Openbase's modular imports, chart series and SVG SSR init
API remain supported. Defaults can still alter output without an API error.
Do not mark chart-review warnings resolved until these checks pass:

- Render line, vertical and horizontal bar, pie, radar, scatter and waterfall
  modules, including query previews and shared dashboards.
- Update chart data and options, resize cards, and toggle loading. Check tooltips,
  legends, axis labels and pie colors, and inspect browser errors.
- Run `e2e/pdf-export.spec.ts` to check SVG card layout and a multi-page PDF.
  This existing test covers server-rendered charts, not the browser Vue wrapper.
- Compare chart and PDF screenshots with the main-branch application using the
  same data, dimensions, browser and OS. Record any intentional style changes;
  do not generate or accept new baselines merely to silence a failing check.

These runtime and visual checks have not been performed in this environment.
The PR remains a draft pending verification. No chart majors were downgraded or
new rendering options added solely to silence speculative review warnings.

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
