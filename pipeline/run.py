"""
Pipeline Orchestrator
Runs ingest → resolve → score in sequence.
Called by GitHub Actions pipeline.yml.
"""

import sys
import os
import json
import logging
from datetime import datetime

from ingest import main as ingest
from resolve import main as resolve
from score import main as score

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main():
    mode = os.environ.get("PIPELINE_MODE", "full")
    states = os.environ.get("PIPELINE_STATES", "TX").split(",")
    years = [int(y) for y in os.environ.get("PIPELINE_YEARS", "2022,2023").split(",")]
    sector = os.environ.get("PIPELINE_SECTOR")

    logger.info(f"Pipeline starting — mode={mode}, states={states}, years={years}")
    started_at = datetime.utcnow()

    results = {
        "mode": mode,
        "states": states,
        "years": years,
        "started_at": started_at.isoformat(),
    }

    try:
        if mode == "full":
            logger.info("Stage 1: Ingesting HCRIS data...")
            results["ingested"] = ingest(states=states, years=years)

            logger.info("Stage 2: Resolving entities...")
            results["resolved"] = resolve(new_only=False)

        elif mode == "refresh":
            logger.info("Stage 2: Resolving new entities only...")
            results["resolved"] = resolve(new_only=True)

        elif mode == "new-only":
            logger.info("Stage 2: Resolving new entities only...")
            results["resolved"] = resolve(new_only=True)

        else:
            logger.warning(f"Unknown mode '{mode}', defaulting to score-only")

        logger.info("Stage 3: Scoring all entities...")
        score_result = score(sector=sector)
        results["scored"] = score_result

        results["status"] = "success"
        results["completed_at"] = datetime.utcnow().isoformat()

        logger.info(f"Pipeline complete: {json.dumps(results)}")
        print(json.dumps(results))
        return 0

    except Exception as e:
        results["status"] = "error"
        results["error"] = str(e)
        results["completed_at"] = datetime.utcnow().isoformat()
        logger.error(f"Pipeline failed: {e}")
        print(json.dumps(results), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
