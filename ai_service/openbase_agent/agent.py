from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from pydantic_ai import Agent, RunContext

from .client import OpenbaseClient
from .models import AgentContext, AgentFinalResponse, ChatResponse, DashboardArtifact


@dataclass
class AgentDeps:
    client: OpenbaseClient
    public_origin: str | None = None


def _model_name() -> str:
    return os.getenv("PYDANTIC_AI_MODEL", "openai:gpt-5.2")


def _build_model() -> Any:
    model_name = _model_name()
    if model_name.startswith("azure-openai:") or model_name.startswith("azure:"):
        from openai import AsyncAzureOpenAI
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        deployment = model_name.split(":", 1)[1]
        client = AsyncAzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-07-01-preview"),
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
        )
        return OpenAIChatModel(deployment, provider=OpenAIProvider(openai_client=client))

    return model_name


agent = Agent(
    deps_type=AgentDeps,
    output_type=AgentFinalResponse,
    instructions=(
        "You are the Openbase dashboard agent. You can inspect connected databases, "
        "inspect the supported ECharts catalog, and create dashboards through tools. "
        "For requests that ask for revenue month over month for DE and UK on a line chart, "
        "call create_revenue_month_over_month_dashboard. Return the created share URL, SQL, "
        "and concise steps. Do not invent data or links."
    ),
)


@agent.tool
async def list_connected_databases(ctx: RunContext[AgentDeps]) -> AgentContext:
    """Return active Openbase database connections and the supported ECharts catalog."""
    return await ctx.deps.client.get_agent_context()


@agent.tool
async def create_revenue_month_over_month_dashboard(
    ctx: RunContext[AgentDeps],
    prompt: str,
) -> DashboardArtifact:
    """Create a saved SQL query, line chart visualization, dashboard, and shared link for the prompt."""
    return await ctx.deps.client.create_dashboard(prompt, ctx.deps.public_origin)


@agent.tool
async def create_pdf_export(ctx: RunContext[AgentDeps], dashboard_slug: str) -> str:
    """Future tool placeholder for creating a PDF export from a dashboard slug."""
    return f"PDF export is registered as a planned tool for dashboard {dashboard_slug}."


@agent.tool
async def create_excel_file(ctx: RunContext[AgentDeps], query_id: str) -> str:
    """Future tool placeholder for exporting saved query data to Excel."""
    return f"Excel export is registered as a planned tool for query {query_id}."


@agent.tool
async def email_file(ctx: RunContext[AgentDeps], file_id: str, email: str) -> str:
    """Future tool placeholder for emailing a generated file to a recipient."""
    return f"Email delivery is registered as a planned tool for {file_id} to {email}."


def _response_from_artifact(artifact: DashboardArtifact, runtime: str, tool_calls: list[str]) -> ChatResponse:
    return ChatResponse(
        message=artifact.message,
        shareUrl=artifact.shareUrl,
        sql=artifact.sql,
        dataSourceId=artifact.dataSourceId,
        dataSourceName=artifact.dataSourceName,
        queryId=artifact.queryId,
        visualizationId=artifact.visualizationId,
        dashboardId=artifact.dashboardId,
        dashboardSlug=artifact.dashboardSlug,
        shareToken=artifact.shareToken,
        preview=artifact.preview,
        steps=artifact.steps,
        chartCatalog=artifact.chartCatalog,
        toolCalls=tool_calls,
        agentRuntime=runtime,
    )


def _response_from_agent_output(output: AgentFinalResponse, runtime: str) -> ChatResponse:
    return ChatResponse(
        message=output.message,
        shareUrl=output.shareUrl,
        sql=output.sql,
        steps=output.steps,
        agentRuntime=runtime,
    )


async def run_chat(message: str, public_origin: str | None) -> ChatResponse:
    deps = AgentDeps(client=OpenbaseClient.from_env(), public_origin=public_origin)

    if not os.getenv("OPENAI_API_KEY") and _model_name().startswith("openai:"):
        artifact = await deps.client.create_dashboard(message, public_origin)
        return _response_from_artifact(
            artifact,
            runtime="pydantic-ai-service:fallback-no-model-key",
            tool_calls=["create_revenue_month_over_month_dashboard"],
        )

    result = await agent.run(message, deps=deps, model=_build_model())
    return _response_from_agent_output(result.output, runtime="pydantic-ai")
