# Nuxt 4.4 Improvements

Date: 2026-07-06

Source reviewed:
- https://github.com/nuxt/nuxt/releases/tag/v4.4.0
- https://nuxt.com/docs/4.x/api/composables/create-use-fetch
- https://nuxt.com/docs/4.x/api/components/nuxt-announcer

## Implemented

### Dependency upgrade

- Upgraded `nuxt` from `^4.3.1` to `^4.4.5`.
- Upgraded `@nuxt/ui` from `^4.5.1` to `^4.9.0` so its peer dependency accepts Vue Router 5.
- Removed the direct `vue-router` dependency because the app does not import it directly; Nuxt now owns the Vue Router 5 dependency.

### Nuxt config

Enabled Nuxt 4.4 experimental options in `nuxt.config.ts`:

- `experimental.payloadExtraction = 'client'` to inline cached-route payloads into the initial HTML while still supporting payload files for client navigation.
- `experimental.normalizeComponentNames = true` to make page component names match route names more consistently in tooling/debug output.

### Accessibility announcer

- Added `<NuxtAnnouncer />` and `<NuxtRouteAnnouncer />` to `app/app.vue`.
- Updated `useAppToast()` so toast messages are announced to assistive technology:
  - success/info toasts use polite announcements
  - error toasts use assertive announcements

### Custom fetch factory

- Added `app/composables/useAppFetch.ts` using Nuxt 4.4's `createUseFetch`.
- The wrapper keeps SSR-authenticated internal API calls on `useRequestFetch()` while still behaving like `useFetch`.
- Migrated the admin home session fetch to `useAppFetch`.

### Build profiling

- Added `npm run build:profile`, which runs `nuxt build --profile`.
- This exposes Nuxt 4.4's build profiling output without requiring developers to remember the raw CLI flag.

## Not Applied

- Typed layout props in `definePageMeta`: no current page/layout pair needs per-page layout props.
- `useCookie({ refresh: true })`: frontend cookie handling is not used for the server-managed auth cookies in this app.
- `clearNuxtState` reset-to-default: no current state reset flow needed this behavior.
- View transition types: the app does not currently enable Nuxt view transitions.
- `createUseAsyncData`: existing `useAsyncData` usage is narrow; `createUseFetch` covered the recurring authenticated fetch need with less churn.

## Verification

Commands run:

```bash
npx nuxt prepare
npx tsc --noEmit
npm ls vue-router nuxt @nuxt/ui --depth=0
npm ls vue-router
npm run build
```

Results:

- Nuxt generated types successfully.
- TypeScript completed with no errors.
- Root dependencies are `nuxt@4.4.5` and `@nuxt/ui@4.9.0`.
- Vue Router resolves transitively to `vue-router@5.1.0` through Nuxt/Nuxt UI.
- Production build completed successfully.

Notes:

- Running npm from the host Node 20 shell emits an engine warning for `rollup-plugin-visualizer@7.0.1`, which requires Node 22+. The project Dockerfile and devcontainer already use Node 24, so containerized development/builds satisfy this requirement.
- The production build still reports existing Rollup warnings about sourcemaps/pure annotations and a large chunk warning. These are not introduced by app code changes in this branch.
