# Standalone Setup Cheatsheet

This cheatsheet covers how to spin up the `opposite-osiris` website in a standalone Docker environment, bypassing the need for the full `track-binocle` monorepo stack.

## 1. Start the Container

A standalone `docker-compose.yml`, `Dockerfile.standalone`, and `entrypoint.standalone.sh` have been provided to run just this frontend without modifying the original monorepo files. From the repository root, start it in the background:

```bash
docker compose up -d --build
```

> **Note:** The first time you run this, Docker will build the image. The custom `entrypoint.standalone.sh` will automatically run `pnpm install` to ensure all your `node_modules` are up to date.

## 2. Enter the Docker Shell

Because this project is strictly configured to run its Node commands inside Docker, you must open a shell inside the running container to run development scripts:

```bash
# Using the helper script:
./scripts/docker-workflow.sh shell

# Or using raw docker compose:
docker compose exec opposite-osiris sh
```

## 3. Start the Development Server

Once inside the container shell (`/workspace $`), you can start the Astro development server:

```bash
pnpm dev
```

The website will be served at **http://localhost:4322**.

## 4. Other Useful Commands

All of these should be run **inside the container shell** (`/workspace $`):

- **Build for production:** `pnpm build`
- **Lint the codebase:** `pnpm lint`
- **Run Astro checks:** `pnpm check`
- **Manually update dependencies:** `pnpm install`

## Troubleshooting

- **`ENOSPC: System limit for number of file watchers reached`** 
  If Vite crashes with this error on startup, it means Linux ran out of file watchers. We've configured `astro.config.mjs` to ignore `.pnpm-store` and `node_modules` which usually fixes this. If it persists, you can increase your host machine's watcher limit: `sudo sysctl fs.inotify.max_user_watches=524288`.
