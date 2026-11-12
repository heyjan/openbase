# Font loading

Openbase uses `@nuxt/fonts` with the Google provider. `nuxt.config.ts` registers every family from `shared/design-settings.ts` globally because appearance settings select fonts through a CSS variable at runtime. CSS scanning alone cannot detect those selections.

The configured families are Inter, IBM Plex Sans, Source Sans 3, and Noto Sans. Each uses normal styles at weights 400, 500, 600, and 700. Nuxt Fonts generates `font-display: swap` by default. Global font faces load on demand when the browser uses them.

Nuxt Fonts replaces the deprecated `@nuxtjs/google-fonts` module. It downloads font files and serves them from the application instead of adding Google stylesheet links to the browser. Builds need network access to the Google font provider and font files. No database or environment-variable changes are required.

Nuxt UI's automatic font integration remains disabled because the app registers and configures the module directly. `app/utils/design-settings.ts` only changes the selected CSS family and other appearance variables. It no longer inserts a remote stylesheet.

## Verification

After rebuilding and starting the Podman stack, run:

```sh
podman compose exec app pnpm run build
podman compose exec app pnpm run test:e2e -- e2e/fonts.spec.ts
```

The font tests load every configured weight for each family and reject browser requests to Google's font domains. Also verify the font selector under appearance settings, including switching back to Inter.
