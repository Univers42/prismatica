# Prismatica

Frontend of Prismatica: landing page, authentication portal and workspace UI.

Built with [Astro](https://astro.build). Deployed on Vercel:

- Production: https://prismatica-eta.vercel.app
- Beta (develop): https://prismatica-beta.vercel.app

Part of the ft_transcendence / track-binocle ecosystem. Session bridge to the osionos BaaS.

## Stack

- Astro 7 + TypeScript
- pnpm (`packageManager: pnpm@11.5.1`)
- Vitest, ESLint, Stylelint, html-validate
- i18n: English, Spanish, Arabic
- CI: Quality Gate + Vercel deploy + ghcr.io images

## Local development

This project expects to run inside Docker when used from the monorepo. For a standalone clone:

```sh
pnpm install
pnpm dev:astro          # or the container-guarded scripts
pnpm build
pnpm test:watch
```

See `package.json` scripts for the full list (lint, a11y audit, security checks, etc.).

Environment variables: copy `.env.example` and fill the required values (auth, Turnstile, site URL, etc.).

## Branches

- `main` → production
- `develop` → beta

## License

MIT
