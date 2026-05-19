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


def _model_name(provider_settings: dict[str, Any] | None = None) -> str:
    if provider_settings and isinstance(provider_settings.get("model"), str):
        return provider_settings["model"]
    return os.getenv("PYDANTIC_AI_MODEL", "openai:gpt-5.2")


def _build_model(provider_settings: dict[str, Any] | None = None) -> Any:
    model_name = _model_name(provider_settings)
    if model_name.startswith("azure-openai:") or model_name.startswith("azure:"):
        from openai import AsyncAzureOpenAI
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        deployment = model_name.split(":", 1)[1]
        azure_settings = (provider_settings or {}).get("azureOpenai") or {}
        client = AsyncAzureOpenAI(
            azure_endpoint=azure_settings.get("endpoint") or os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=azure_settings.get("apiVersion") or os.getenv("AZURE_OPENAI_API_VERSION", "2024-07-01-preview"),
            api_key=azure_settings.get("apiKey") or os.environ["AZURE_OPENAI_API_KEY"],
        )
        return OpenAIChatModel(deployment, provider=OpenAIProvider(openai_client=client))

    if model_name.startswith("openai:") and provider_settings:
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        api_key = ((provider_settings.get("openai") or {}).get("apiKey"))
        if api_key:
            return OpenAIChatModel(
                model_name.split(":", 1)[1],
                provider=OpenAIProvider(api_key=api_key),
            )

    if model_name.startswith("deepseek:") and provider_settings:
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.deepseek import DeepSeekProvider

        api_key = ((provider_settings.get("deepseek") or {}).get("apiKey"))
        if api_key:
            return OpenAIChatModel(
                model_name.split(":", 1)[1],
                provider=DeepSeekProvider(api_key=api_key),
            )

    if model_name.startswith("anthropic:") and provider_settings:
        from pydantic_ai.models.anthropic import AnthropicModel
        from pydantic_ai.providers.anthropic import AnthropicProvider

        api_key = ((provider_settings.get("anthropic") or {}).get("apiKey"))
        if api_key:
            return AnthropicModel(
                model_name.split(":", 1)[1],
                provider=AnthropicProvider(api_key=api_key),
            )

    return model_name


agent = Agent(
    deps_type=AgentDeps,
    output_type=AgentFinalResponse,
    instructions=(
        "You are the Openbase dashboard agent. Your job is to answer analytics requests by "
        "creating read-only SQL, choosing one supported ECharts visualization, creating a "
        "dashboard, and returning the shared link. Always inspect list_connected_databases "
        "before writing SQL so you know the available data sources, tables, columns, sample "
        "values, and chart catalog. Use only SELECT or WITH queries. Never invent tables, "
        "columns, data, IDs, or links. Choose the chart type from the provided catalog and "
        "pass the required visualization config to create_dashboard_from_sql. If the request "
        "is ambiguous, make the smallest reasonable assumption and mention it in the steps. "
        "If the available schema cannot answer the request, return a helpful message explaining "
        "what data or clarification is missing instead of creating a dashboard. PDF, Excel, "
        "and email delivery tools are planned but not available yet, so do not promise those "
        "actions."
    ),
)


@agent.tool
async def list_connected_databases(ctx: RunContext[AgentDeps]) -> AgentContext:
    """Return active Openbase database connections and the supported ECharts catalog."""
    return await ctx.deps.client.get_agent_context()


@agent.tool
async def create_dashboard_from_sql(
    ctx: RunContext[AgentDeps],
    title: str,
    data_source_id: str,
    sql: str,
    module_type: str,
    visualization_config: dict[str, Any],
    prompt: str,
) -> DashboardArtifact:
    """Create a saved query, visualization, dashboard, and shared link from generated read-only SQL."""
    return await ctx.deps.client.create_dashboard(
        prompt,
        ctx.deps.public_origin,
        data_source_id=data_source_id,
        title=title,
        sql=sql,
        module_type=module_type,
        visualization_config=visualization_config,
    )


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


def _can_use_revenue_fallback(message: str) -> bool:
    normalized = message.lower()
    return (
        any(token in normalized for token in ("revenue", "sales", "turnover", "gmv"))
        and any(token in normalized for token in ("month", "monthly", "mom", "month over month"))
    )


async def run_chat(
    message: str,
    public_origin: str | None,
    provider_settings: dict[str, Any] | None = None,
) -> ChatResponse:
    deps = AgentDeps(client=OpenbaseClient.from_env(), public_origin=public_origin)

    if (
        not provider_settings
        and not os.getenv("OPENAI_API_KEY")
        and _model_name().startswith("openai:")
    ):
        if not _can_use_revenue_fallback(message):
            return ChatResponse(
                message=(
                    "AI provider credentials are not configured. Configure an AI provider in "
                    "Admin Settings to let the agent inspect schema, write SQL, choose a chart, "
                    "and create dashboards for general analytics questions."
                ),
                steps=["Skipped dashboard creation because no AI model credentials are available."],
                agentRuntime="pydantic-ai-service:no-model-key",
            )
        try:
            artifact = await deps.client.create_dashboard(message, public_origin)
            return _response_from_artifact(
                artifact,
                runtime="pydantic-ai-service:fallback-no-model-key",
                tool_calls=["revenue_month_over_month_fallback"],
            )
        except Exception as exc:
            return ChatResponse(
                message=(
                    "I could not create the fallback revenue dashboard. Configure an AI provider "
                    "for general SQL/dashboard generation, or check the connected data source schema."
                ),
                steps=[f"Fallback dashboard creation failed: {type(exc).__name__}: {exc}"],
                agentRuntime="pydantic-ai-service:fallback-error",
            )

    try:
        result = await agent.run(message, deps=deps, model=_build_model(provider_settings))
    except Exception as exc:
        return ChatResponse(
            message=(
                "I could not complete the dashboard request. Check the AI provider credentials, "
                "connected data sources, and whether the requested fields exist."
            ),
            steps=[f"Pydantic AI run failed: {type(exc).__name__}: {exc}"],
            agentRuntime="pydantic-ai:error",
        )

    return _response_from_agent_output(result.output, runtime="pydantic-ai")
