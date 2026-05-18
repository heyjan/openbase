from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PreviewResult(BaseModel):
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)


class DashboardArtifact(BaseModel):
    message: str
    shareUrl: str | None = None
    sql: str | None = None
    dataSourceId: str | None = None
    dataSourceName: str | None = None
    queryId: str | None = None
    visualizationId: str | None = None
    dashboardId: str | None = None
    dashboardSlug: str | None = None
    shareToken: str | None = None
    preview: PreviewResult = Field(default_factory=PreviewResult)
    steps: list[str] = Field(default_factory=list)
    chartCatalog: list[dict[str, Any]] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str
    publicOrigin: str | None = None
    admin: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    message: str
    shareUrl: str | None = None
    sql: str | None = None
    dataSourceId: str | None = None
    dataSourceName: str | None = None
    queryId: str | None = None
    visualizationId: str | None = None
    dashboardId: str | None = None
    dashboardSlug: str | None = None
    shareToken: str | None = None
    preview: PreviewResult = Field(default_factory=PreviewResult)
    steps: list[str] = Field(default_factory=list)
    chartCatalog: list[dict[str, Any]] = Field(default_factory=list)
    toolCalls: list[str] = Field(default_factory=list)
    agentRuntime: str = "pydantic-ai"


class AgentFinalResponse(BaseModel):
    message: str
    shareUrl: str | None = None
    sql: str | None = None
    steps: list[str] = Field(default_factory=list)


class DataSourceSummary(BaseModel):
    id: str
    name: str
    type: str
    is_active: bool


class AgentContext(BaseModel):
    dataSources: list[DataSourceSummary] = Field(default_factory=list)
    charts: list[dict[str, Any]] = Field(default_factory=list)
