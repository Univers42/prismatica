# syntax=docker/dockerfile:1.7
FROM public.ecr.aws/docker/library/node:22-alpine

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
	apk add --update-cache python3 make g++ \
		chromium nss freetype harfbuzz ca-certificates ttf-freefont

RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

ENV CHROME_PATH=/usr/bin/chromium-browser \
	PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
	PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /workspace

COPY docker/services/node/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sleep", "infinity"]
