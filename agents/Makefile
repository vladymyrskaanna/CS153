.PHONY: install dashboard research smoke clean test test-unit test-integration test-e2e check-skills eval

PY := .venv/bin/python
PIP := .venv/bin/pip

install:
	python3 -m venv .venv
	$(PIP) install -e ".[dashboard,dev]"

# ─── skillify quality gates ──────────────────────────────────────────────

test:                ## Run the full test suite (unit + integration + e2e)
	$(PY) -m pytest tests/ -v

test-unit:
	$(PY) -m pytest tests/ -v -m unit

test-integration:
	$(PY) -m pytest tests/ -v -m integration

test-e2e:
	$(PY) -m pytest tests/ -v -m e2e

check-skills:        ## skillify item #8 — resolver reachability + MECE
	$(PY) -m aimerch.cli.check_skills

eval:                ## Run the LLM evals (real LLM calls — costs money)
	$(PY) -m evals.eval_email_writer

# Full quality gate — green = ready to ship.
gate: test check-skills
	@echo "✓ All gates passed."

research:
	@test -n "$(URL)" || (echo "usage: make research URL=https://saratogaeagle.com" && exit 1)
	$(PY) -m aimerch.cli.main research $(URL)

regen:
	@test -n "$(SLUG)" || (echo "usage: make regen SLUG=saratoga_eagle_sales_service_inc" && exit 1)
	$(PY) -m aimerch.cli.main regenerate $(SLUG)

ls:
	$(PY) -m aimerch.cli.main ls

dashboard:
	$(PY) -m streamlit run dashboard/app.py

smoke:
	$(PY) -m aimerch.cli.main research https://saratogaeagle.com

clean:
	rm -rf dossiers/* data/*.db
