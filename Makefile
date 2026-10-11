.PHONY: setup dev up down migrate test test-integration test-e2e lint build train evaluate ml-smoke demo-seed quality-study aligned-plan aligned-source aligned-collect aligned-evaluate test-operational
PYTHON := .venv/bin/python
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
setup:
	npm ci
	python3 -m venv .venv
	$(PYTHON) -m pip install -r ml/requirements.txt
dev:
	npm run dev
up:
	docker compose up --build -d --wait
down:
	docker compose down
migrate:
	npm run migrate
test:
	npm test
	$(PYTHON) -m unittest discover -s ml -p 'test_*.py'
test-integration:
	npm run test:integration
test-e2e:
	npm run test:e2e
lint:
	npm run lint
build:
	npm run build
train:
	@test -n "$(DATASET)" || (echo 'Provide DATASET=/path/to/labeled.csv; use make ml-smoke for synthetic validation.'; exit 1)
	$(PYTHON) ml/pipeline.py train --dataset "$(DATASET)" --validation-start "$(or $(VALIDATION_START),2026-02-01)" --test-start "$(or $(TEST_START),2026-03-01)"
evaluate:
	$(PYTHON) ml/pipeline.py evaluate
ml-smoke:
	LOKY_MAX_CPU_COUNT=2 $(PYTHON) ml/pipeline.py smoke
benchmark-import:
	$(PYTHON) ml/benchmark.py
benchmark-train:
	$(PYTHON) ml/pipeline.py train --dataset ml/data/phiusiil.csv --split group
	$(PYTHON) ml/pipeline.py evaluate
phreshphish-import:
	$(PYTHON) ml/phreshphish.py --download
phreshphish-train:
	$(PYTHON) ml/pipeline.py train --dataset ml/data/phreshphish.csv --validation-start 2025-07-01 --test-start 2025-09-09 --artifacts ml/artifacts/phreshphish-v2
	$(PYTHON) ml/pipeline.py evaluate --artifacts ml/artifacts/phreshphish-v2
promote:
	$(PYTHON) ml/promotion.py --artifacts "$(or $(ARTIFACTS),ml/artifacts/phreshphish-v2)"
test-scanner:
	python3 -m unittest discover -s services/analysis-worker -p 'test_*.py'
test-isolation:
	python3 services/analysis-worker/verify_isolation.py
demo-seed:
	npm run demo-seed
quality-study:
	$(PYTHON) ml/quality_study.py
aligned-plan:
	$(PYTHON) ml/aligned_evaluation.py --freeze-plan
	$(PYTHON) ml/external_validation.py --freeze-plan
aligned-source:
	$(PYTHON) ml/aligned_sources.py
aligned-collect:
	npx tsx scripts/aligned-cohort.ts
aligned-evaluate:
	$(PYTHON) ml/aligned_evaluation.py
	$(PYTHON) ml/external_validation.py
test-operational:
	npx tsx scripts/operational-acceptance.ts
