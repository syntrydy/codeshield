"""Eval runner: load dataset fixtures, invoke the review graph, score results.

Usage:
    uv run python -m evals.run                 # full dataset
    uv run python -m evals.run --subset=fast   # first 3 fixtures (CI gate)
    uv run python -m evals.run --fixture=pr_001_sql_injection
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
import uuid
from pathlib import Path
from typing import Any

import yaml

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATASET_DIR = Path(__file__).parent / "dataset"
# Recall regression gate used by CI: fail if recall drops below this fraction
RECALL_GATE = 0.60
# False-positive gate: fail if FP rate exceeds this fraction
FP_GATE = 0.30


# ── Dataset loading ────────────────────────────────────────────────────────────

def load_fixtures(subset: str | None = None, fixture_id: str | None = None) -> list[dict[str, Any]]:
    files = sorted(DATASET_DIR.glob("*.yaml"))
    if fixture_id:
        files = [f for f in files if f.stem == fixture_id]
    fixtures = [yaml.safe_load(f.read_text()) for f in files]
    if subset == "fast":
        fixtures = fixtures[:3]
    return fixtures


# ── Matching helpers ──────────────────────────────────────────────────────────

def _line_overlap(range_a: tuple[int, int], range_b: tuple[int, int]) -> float:
    """Return overlap fraction of range_b covered by range_a."""
    start = max(range_a[0], range_b[0])
    end = min(range_a[1], range_b[1])
    if start > end:
        return 0.0
    overlap = end - start + 1
    b_len = range_b[1] - range_b[0] + 1
    return overlap / b_len if b_len > 0 else 0.0


_SEVERITY_ORDER = ["info", "low", "medium", "high", "critical"]


def _severity_within_one(a: str, b: str) -> bool:
    try:
        return abs(_SEVERITY_ORDER.index(a) - _SEVERITY_ORDER.index(b)) <= 1
    except ValueError:
        return False


def _finding_matches_expected(finding: dict[str, Any], expected: dict[str, Any]) -> bool:
    """True if the produced finding matches an expected finding."""
    if finding.get("file_path") != expected.get("file"):
        return False
    exp_range: list[int] = expected.get("line_range", [0, 0])
    prod_start = finding.get("line_start") or 0
    prod_end = finding.get("line_end") or prod_start
    overlap = _line_overlap((prod_start, prod_end), (exp_range[0], exp_range[1]))
    if overlap < 0.5:
        return False
    return _severity_within_one(
        finding.get("severity", "low"),
        expected.get("severity", "low"),
    )


def _finding_is_negative(finding: dict[str, Any], negatives: list[dict[str, Any]]) -> bool:
    """True if the produced finding matches any explicitly-listed false-positive description."""
    explanation = (finding.get("explanation") or "").lower()
    for neg in negatives:
        keywords = (neg.get("description") or "").lower().split()[:4]
        if any(kw in explanation for kw in keywords if len(kw) > 4):
            return True
    return False


# ── Graph invocation ──────────────────────────────────────────────────────────

def _invoke_graph(fixture: dict[str, Any]) -> dict[str, Any]:
    """Invoke the compiled LangGraph on a fixture and return the result dict."""
    from app.graph.graph import compiled_graph
    from app.graph.state import ReviewState

    run_id = str(uuid.uuid4())
    state: ReviewState = {
        "run_id": run_id,
        "project_id": "eval-project",
        "pr_url": fixture["pr_url"],
        "pr_head_sha": fixture["pr_head_sha"],
        "pr_base_sha": fixture["pr_base_sha"],
        "locale": fixture.get("locale", "en"),
        "enabled_specialists": fixture.get("enabled_specialists", ["security", "correctness", "performance", "style"]),
        "plan": None,
        "changed_files": [f["path"] for f in fixture.get("changed_files", [])],
        "findings": [],
        "specialist_errors": [],
        "final_review": None,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
    }
    raw: Any = compiled_graph.invoke(state)
    return raw  # type: ignore[no-any-return]


# ── Scoring ───────────────────────────────────────────────────────────────────

def score_fixture(fixture: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, Any]] = result.get("findings", [])
    expected: list[dict[str, Any]] = fixture.get("expected_findings", [])
    negatives: list[dict[str, Any]] = fixture.get("negative_findings", [])
    expected_verdict: str = fixture.get("expected_verdict", "")
    produced_verdict: str = (result.get("final_review") or {}).get("verdict", "")

    matched = [e for e in expected if any(_finding_matches_expected(f, e) for f in findings)]
    recall = len(matched) / len(expected) if expected else 1.0

    fp_findings = [f for f in findings if _finding_is_negative(f, negatives)]
    fp_rate = len(fp_findings) / len(findings) if findings else 0.0

    non_neg = [f for f in findings if not _finding_is_negative(f, negatives)]
    precision = len(non_neg) / len(findings) if findings else 1.0

    verdict_correct = produced_verdict == expected_verdict

    return {
        "fixture_id": fixture["id"],
        "recall": round(recall, 3),
        "precision": round(precision, 3),
        "fp_rate": round(fp_rate, 3),
        "verdict_correct": verdict_correct,
        "expected_verdict": expected_verdict,
        "produced_verdict": produced_verdict,
        "total_findings": len(findings),
        "matched_expected": len(matched),
        "total_expected": len(expected),
        "cost_usd": result.get("total_cost_usd", 0),
        "input_tokens": result.get("total_input_tokens", 0),
        "output_tokens": result.get("total_output_tokens", 0),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="CodeShield eval runner")
    parser.add_argument("--subset", choices=["fast"], help="Run only the first 3 fixtures")
    parser.add_argument("--fixture", help="Run a single fixture by ID")
    args = parser.parse_args()

    fixtures = load_fixtures(subset=args.subset, fixture_id=args.fixture)
    if not fixtures:
        logger.error("No fixtures found — check DATASET_DIR and fixture ID")
        sys.exit(1)

    logger.info("Running eval on %d fixture(s)...", len(fixtures))
    scores: list[dict[str, Any]] = []

    for fixture in fixtures:
        fid = fixture["id"]
        logger.info("  [%s] invoking graph...", fid)
        t0 = time.monotonic()
        try:
            result = _invoke_graph(fixture)
        except Exception as exc:
            logger.error("  [%s] graph invocation failed: %s", fid, exc)
            scores.append({"fixture_id": fid, "error": str(exc), "recall": 0.0, "fp_rate": 1.0})
            continue
        elapsed = time.monotonic() - t0
        score = score_fixture(fixture, result)
        score["latency_s"] = round(elapsed, 2)
        scores.append(score)
        logger.info(
            "  [%s] recall=%.2f precision=%.2f fp_rate=%.2f verdict=%s latency=%.1fs",
            fid, score["recall"], score["precision"], score["fp_rate"],
            "✓" if score["verdict_correct"] else "✗",
            elapsed,
        )

    # Aggregate
    valid = [s for s in scores if "error" not in s]
    if not valid:
        logger.error("All fixtures failed")
        sys.exit(1)

    avg_recall = sum(s["recall"] for s in valid) / len(valid)
    avg_fp = sum(s["fp_rate"] for s in valid) / len(valid)
    avg_precision = sum(s["precision"] for s in valid) / len(valid)
    verdict_acc = sum(1 for s in valid if s.get("verdict_correct")) / len(valid)
    total_cost = sum(s.get("cost_usd", 0) for s in valid)

    print("\n── Eval summary ──────────────────────────────────")
    print(f"  Fixtures run  : {len(scores)} ({len(valid)} passed, {len(scores) - len(valid)} errored)")
    print(f"  Avg recall    : {avg_recall:.3f}  (gate: ≥{RECALL_GATE})")
    print(f"  Avg precision : {avg_precision:.3f}")
    print(f"  Avg FP rate   : {avg_fp:.3f}  (gate: ≤{FP_GATE})")
    print(f"  Verdict acc   : {verdict_acc:.3f}")
    print(f"  Total cost    : ${total_cost:.4f}")
    print()

    # Write JSON for CodeBuild reports / LangSmith upload
    out_path = Path(__file__).parent / "results.json"
    out_path.write_text(json.dumps({"summary": {
        "avg_recall": avg_recall,
        "avg_precision": avg_precision,
        "avg_fp_rate": avg_fp,
        "verdict_accuracy": verdict_acc,
        "total_cost_usd": total_cost,
    }, "fixtures": scores}, indent=2))
    logger.info("Results written to %s", out_path)

    # CI gates
    failed = False
    if avg_recall < RECALL_GATE:
        logger.error("GATE FAILED: recall %.3f < %.3f", avg_recall, RECALL_GATE)
        failed = True
    if avg_fp > FP_GATE:
        logger.error("GATE FAILED: fp_rate %.3f > %.3f", avg_fp, FP_GATE)
        failed = True

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
