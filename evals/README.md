# Evals

This directory contains the evaluation dataset and tooling for measuring review quality (see DESIGN.md §13).

## Structure

```
evals/
  dataset/        YAML-labeled PR fixtures (one file per PR)
  README.md       this file
```

## Dataset format

Each file under `dataset/` describes one curated PR and its expected review outcome:

```yaml
pr_url: https://github.com/owner/repo/pull/123
description: "Brief human description of what this PR does and why it's useful as a test case"
expected_findings:
  - specialist: security          # security | correctness | performance | style
    file: src/auth/login.py
    line_range: [42, 55]
    description: "SQL injection via unsanitized user input in query construction"
    severity: critical            # info | low | medium | high | critical
negative_findings:
  - description: "Flagging the logging statement as a secret leak is a false positive"
expected_verdict: request_changes # approve | request_changes | comment
```

## Metrics

- **Recall** — fraction of `expected_findings` matched (same file, ≥50% line overlap, severity within one level)
- **Precision** — fraction of produced findings not in `negative_findings`
- **False positive rate** — findings in `negative_findings` that were raised
- **Verdict accuracy** — produced verdict matches `expected_verdict`
- **Cost per review** — median USD across dataset
- **Latency** — p50/p95 total review duration

Per-specialist breakdowns on recall and precision enable targeted prompt tuning.

## CI integration

`buildspec/test.yml` runs a fast subset (3 PRs) on every push. A nightly job runs the full suite and posts results to LangSmith. PRs cannot merge to `main` if they cause >5% recall drop or >10% false positive rate increase vs. the last green run.

## Populating the dataset

Dataset files are added during Day 5 (eval session). Sources:
- GitHub Security Advisories — PRs that fixed real CVEs (Security specialist ground truth)
- Reverted PRs from large open-source repos (Correctness ground truth)
- High-engagement review threads on major frameworks (community-labeled issues)
