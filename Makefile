BACKEND_PORT := 8076
UI_PORT := 5173

.PHONY: dev backend frontend kill-ports

## dev: kill ports, then run backend (:8076) + frontend (:5173) together
dev:
	@$(MAKE) kill-ports
	@$(MAKE) -j2 backend frontend

backend:
	cd backend && PORT=$(BACKEND_PORT) CACHE_DIR=.cache go run .

frontend:
	BACKEND_URL=http://localhost:$(BACKEND_PORT) pnpm dev --port $(UI_PORT) --strictPort

kill-ports:
	fuser -k $(BACKEND_PORT)/tcp 2>/dev/null || true
	fuser -k $(UI_PORT)/tcp 2>/dev/null || true
