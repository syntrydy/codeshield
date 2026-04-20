"""Pydantic schemas for structured specialist outputs: Finding, SpecialistResult, FinalReview."""

from typing import Literal

from pydantic import BaseModel, Field


class Finding(BaseModel):
    specialist: Literal["security", "correctness", "performance", "style"]
    severity: Literal["info", "low", "medium", "high", "critical"]
    title: str = Field(max_length=80)
    explanation: str
    confidence: Literal["low", "medium", "high"] = "medium"
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    suggested_fix: str | None = None


class SpecialistResult(BaseModel):
    specialist: Literal["security", "correctness", "performance", "style"]
    findings: list[Finding] = Field(default_factory=list)
    error: str | None = None


class FinalReview(BaseModel):
    summary: str
    verdict: Literal["approve", "request_changes", "comment"]
    findings_by_severity: dict[str, list[Finding]] = Field(default_factory=dict)
    total_findings: int = 0
