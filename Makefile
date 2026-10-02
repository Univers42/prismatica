.PHONY: up
up:
	docker compose up -d --build opposite-osiris
.PHONY: build
build:
	docker compose up -d --build
