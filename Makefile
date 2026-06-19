.PHONY: help install link db-push db-reset functions-deploy secrets-set \
        serve-functions type-check seed clean

SUPABASE := supabase
PROJECT_REF ?= $(shell $(SUPABASE) status --output json 2>/dev/null | jq -r '.DB_URL // empty')

# ── help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Live Poll – backend management"
	@echo ""
	@echo "  Setup (first time):"
	@echo "    make install           Install Supabase CLI"
	@echo "    make link              Link to remote Supabase project"
	@echo "    make secrets-set       Push OPENROUTER_API_KEY to Supabase"
	@echo "    make db-push           Apply migrations to remote DB"
	@echo "    make functions-deploy  Deploy all Edge Functions"
	@echo ""
	@echo "  Local dev:"
	@echo "    make serve-functions   Run functions locally (needs supabase start)"
	@echo "    make type-check        Run deno type-check on all functions"
	@echo "    make seed              Run smoke-test / seed script (needs .env)"
	@echo ""
	@echo "  Reset:"
	@echo "    make db-reset          Drop + recreate local DB and run migrations"
	@echo "    make clean             Remove local Supabase data"
	@echo ""

# ── install ──────────────────────────────────────────────────────────────────
install:
	npm install -g supabase
	@echo "✅  Supabase CLI $(shell supabase --version)"

# ── link to remote project ───────────────────────────────────────────────────
link:
	@test -n "$(SUPABASE_PROJECT_REF)" || (echo "❌  Set SUPABASE_PROJECT_REF=<your-project-ref>" && exit 1)
	$(SUPABASE) link --project-ref $(SUPABASE_PROJECT_REF)

# ── database ─────────────────────────────────────────────────────────────────
db-push:
	$(SUPABASE) db push

db-reset:
	$(SUPABASE) db reset

# ── functions ─────────────────────────────────────────────────────────────────
functions-deploy:
	$(SUPABASE) functions deploy create-poll
	$(SUPABASE) functions deploy get-poll
	$(SUPABASE) functions deploy submit-response
	$(SUPABASE) functions deploy label-cluster

serve-functions:
	$(SUPABASE) functions serve --import-map supabase/functions/deno.json

# ── secrets ──────────────────────────────────────────────────────────────────
secrets-set:
	@test -n "$(OPENROUTER_API_KEY)" || (echo "❌  Set OPENROUTER_API_KEY=sk-or-v1-..." && exit 1)
	$(SUPABASE) secrets set OPENROUTER_API_KEY=$(OPENROUTER_API_KEY)

# ── local type-check ─────────────────────────────────────────────────────────
type-check:
	cd supabase/functions && deno check --import-map=deno.json \
		create-poll/index.ts \
		get-poll/index.ts \
		label-cluster/index.ts \
		submit-response/index.ts

# ── seed / smoke-test ────────────────────────────────────────────────────────
seed:
	@test -f .env || (echo "❌  Create .env from .env.example first" && exit 1)
	@export $$(grep -v '^#' .env | xargs) && \
		deno run --allow-net --allow-env scripts/seed-test.ts

# ── cleanup ──────────────────────────────────────────────────────────────────
clean:
	$(SUPABASE) stop --backup
