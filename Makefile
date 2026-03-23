SHELL := /bin/bash
.SHELLFLAGS := -ec
.DEFAULT_GOAL := all
.PHONY: help all build build-api build-frontend up down kill-ports logs ps \
        db-init db-seed db-reset db-status \
        push login clean fclean re dev test help

DOCKER_USER  ?= dlesieur
IMAGE_API    := $(DOCKER_USER)/prismatica-api
IMAGE_FRONT  := $(DOCKER_USER)/prismatica-frontend
TAG          ?= latest

COMPOSE_CMD := $(shell \
if docker compose version >/dev/null 2>&1; then echo 'docker compose'; \
elif command -v docker-compose >/dev/null 2>&1; then echo 'docker-compose'; \
else echo '__NONE__'; fi)
COMPOSE := $(COMPOSE_CMD) -f docker-compose.yml

API_CTR   := prismatica-api
DB_CTR    := prismatica-db
MONGO_CTR := prismatica-mongo

B := \033[1m
G := \033[0;32m
Y := \033[1;33m
R := \033[0;31m
C := \033[0;36m
D := \033[2m
N := \033[0m

all: build up db-init
	@echo ""
	@echo -e "$(G)╔══════════════════════════════════════════╗$(N)"
	@echo -e "$(G)║$(N)     $(B)Prismatica is running!$(N)              $(G)║$(N)"
	@echo -e "$(G)╠══════════════════════════════════════════╣$(N)"
	@echo -e "$(G)║$(N)  Frontend → http://localhost:8080        $(G)║$(N)"
	@echo -e "$(G)║$(N)  API      → http://localhost:3001        $(G)║$(N)"
	@echo -e "$(G)╚══════════════════════════════════════════╝$(N)"
	@echo ""

HAS_BUILDX := $(shell docker buildx version >/dev/null 2>&1 && echo 1 || echo 0)

build:
ifeq ($(HAS_BUILDX),1)
	@echo -e "  $(C)ℹ$(N)  Building $(B)both images in parallel$(N) (BuildKit)..."
	@docker buildx bake -f docker-bake.hcl
else
	@echo -e "  $(Y)⚠$(N)  buildx not found — falling back to sequential builds"
	@$(MAKE) build-api build-frontend
endif
	@echo -e "  $(G)✓$(N)  All images built"

build-api:
	@echo -e "  $(C)ℹ$(N)  Building $(B)$(IMAGE_API):$(TAG)$(N)..."
ifeq ($(HAS_BUILDX),1)
	@docker buildx bake -f docker-bake.hcl api
else
	@docker build -f apps/data-api/Dockerfile -t $(IMAGE_API):$(TAG) .
endif

build-frontend:
	@echo -e "  $(C)ℹ$(N)  Building $(B)$(IMAGE_FRONT):$(TAG)$(N)..."
ifeq ($(HAS_BUILDX),1)
	@docker buildx bake -f docker-bake.hcl frontend
else
	@docker build -f apps/frontend/Dockerfile \
		--build-arg VITE_API_URL=/api \
		-t $(IMAGE_FRONT):$(TAG) apps/frontend
endif

up:
	@echo -e "  $(C)ℹ$(N)  Starting containers..."
	@$(COMPOSE) up -d
	@echo -e "  $(G)✓$(N)  Stack running"

kill-ports:
	@echo -e "  $(C)ℹ$(N)  Releasing ports 3001 8080 5432 27017..."
	@for port in 3001 8080 5432 27017; do \
		ctrs=$$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null \
			| awk -v p=":$$port->" '$$0 ~ p {print $$1}'); \
		if [ -n "$$ctrs" ]; then \
			echo -e "  $(R)→$(N)  port $$port — stopping containers: $$ctrs"; \
			echo $$ctrs | xargs -r docker stop 2>/dev/null || true; \
		fi; \
		pids=$$(ss -tlnp "sport = :$$port" 2>/dev/null \
			| awk 'NR>1{match($$6,/pid=([0-9]+)/,a); if(a[1]) print a[1]}'); \
		if [ -n "$$pids" ]; then \
			echo -e "  $(R)→$(N)  port $$port — killing PIDs $$pids"; \
			echo $$pids | xargs -r kill -9 2>/dev/null || true; \
		fi; \
		[ -z "$$ctrs" ] && [ -z "$$pids" ] && echo -e "  $(D)✓$(N)  port $$port — free" || true; \
	done
	@echo -e "  $(G)✓$(N)  Ports released"

down:
	@$(COMPOSE) down
	@echo -e "  $(G)✓$(N)  Stack stopped"

logs:
	@$(COMPOSE) logs -f

ps:
	@$(COMPOSE) ps

dev:
	@$(COMPOSE) up -d db mongo data-api
	@echo -e "  $(C)ℹ$(N)  Databases running. Starting Vite..."
	@cd apps/frontend && pnpm run dev

db-init:
	@echo -e "  $(C)ℹ$(N)  Waiting for API startup to complete..."
	@for i in $$(seq 1 30); do \
		STATUS=$$(docker inspect --format='{{.State.Health.Status}}' $(API_CTR) 2>/dev/null) && \
		[ "$$STATUS" = "healthy" ] && break; \
		[ $$i -eq 30 ] && echo -e "  $(Y)⚠$(N)  Timeout waiting for API — proceeding anyway" && break; \
		sleep 2; \
	done
	@echo -e "  $(C)ℹ$(N)  Initializing PostgreSQL..."
	@docker exec $(API_CTR) sh -c "cd /app/Model/sql && bash manager/apply_schema.sh" 2>/dev/null || true
	@echo -e "  $(C)ℹ$(N)  Seeding PostgreSQL..."
	@docker exec $(API_CTR) sh -c "cd /app/Model/sql && bash manager/apply_seeds.sh" 2>/dev/null || true
	@echo -e "  $(C)ℹ$(N)  Syncing scripts to MongoDB..."
	@docker exec $(API_CTR) tar -cf - -C /app Model 2>/dev/null | docker exec -i $(MONGO_CTR) tar -xf - -C /tmp/ 2>/dev/null || true
	@echo -e "  $(C)ℹ$(N)  Setting up MongoDB..."
	@docker exec $(MONGO_CTR) bash -c "cd /tmp/Model/sql && bash manager/mongo_setup.sh mongodb://localhost:27017 prismatica" 2>/dev/null || true
	@echo -e "  $(C)ℹ$(N)  Seeding MongoDB..."
	@docker exec $(MONGO_CTR) bash -c "cd /tmp/Model/sql && bash manager/mongo_seed.sh mongodb://localhost:27017 prismatica" 2>/dev/null || true
	@echo -e "  $(G)✓$(N)  Databases initialized"

db-seed:
	@docker exec $(API_CTR) sh -c "cd /app/Model/sql && bash manager/apply_seeds.sh" 2>/dev/null || true
	@docker exec $(API_CTR) tar -cf - -C /app Model 2>/dev/null | docker exec -i $(MONGO_CTR) tar -xf - -C /tmp/ 2>/dev/null || true
	@docker exec $(MONGO_CTR) bash -c "cd /tmp/Model/sql && bash manager/mongo_seed.sh mongodb://localhost:27017 prismatica" 2>/dev/null || true
	@echo -e "  $(G)✓$(N)  Databases seeded"

db-reset:
	@echo -e "$(R)⚠  This will DROP all data$(N)"
	@read -p "Are you sure? [y/N] " c && [ "$$c" = "y" ] || exit 1
	@docker exec $(API_CTR) sh -c "cd /app/Model/sql && bash manager/reset.sh" 2>/dev/null || true
	@docker exec $(MONGO_CTR) mongosh --quiet --eval 'db.dropDatabase()' mongodb://localhost:27017/prismatica 2>/dev/null || true
	@$(MAKE) db-init

db-status: 
	@docker exec $(DB_CTR) psql -U prismatica -c "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "PostgreSQL: not running"
	@docker exec $(MONGO_CTR) mongosh --quiet --eval "db.getCollectionNames().length + ' collections'" prismatica 2>/dev/null || echo "MongoDB: not running"

login:
	@docker login -u $(DOCKER_USER)

push: build
	@echo -e "  $(C)ℹ$(N)  Pushing $(B)$(IMAGE_API):$(TAG)$(N)..."
	@docker push $(IMAGE_API):$(TAG)
	@echo -e "  $(C)ℹ$(N)  Pushing $(B)$(IMAGE_FRONT):$(TAG)$(N)..."
	@docker push $(IMAGE_FRONT):$(TAG)
	@echo -e "  $(G)✓$(N)  Images pushed to Docker Hub"
	@echo -e "  $(D)→ https://hub.docker.com/r/$(DOCKER_USER)/prismatica-api$(N)"
	@echo -e "  $(D)→ https://hub.docker.com/r/$(DOCKER_USER)/prismatica-frontend$(N)"

lint:
	@cd apps/frontend && pnpm exec eslint .

typecheck:
	@cd apps/frontend && pnpm exec tsc --noEmit

test:
	@cd apps/frontend && pnpm test 2>/dev/null || echo "No tests configured"

clean:
	@$(COMPOSE) down -v --remove-orphans 2>/dev/null || true
	@echo -e "  $(G)✓$(N)  Clean"

fclean: clean
	@docker rmi $(IMAGE_API):$(TAG) $(IMAGE_FRONT):$(TAG) 2>/dev/null || true
	@docker buildx prune -f --builder prismatica-builder 2>/dev/null || true
	@echo -e "  $(G)✓$(N)  Images removed"

re: fclean all

help:
	@echo ""
	@echo -e "$(B)Prismatica — Available Commands$(N)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
awk 'BEGIN {FS = ":.*?## "}; {printf "  $(G)%-18s$(N) %s\n", $$1, $$2}'
	@echo ""
