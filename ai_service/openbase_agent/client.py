from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

from .models import AgentContext, DashboardArtifact


@dataclass(frozen=True)
class OpenbaseClient:
    base_url: str
    service_token: str
    timeout: float = 120.0

    @classmethod
    def from_env(cls) -> "OpenbaseClient":
        base_url = os.getenv("OPENBASE_APP_URL", "http://app:3000").rstrip("/")
        service_token = os.getenv("OPENBASE_AI_SERVICE_TOKEN", "")
        if not service_token:
            raise RuntimeError("OPENBASE_AI_SERVICE_TOKEN is required")
        return cls(base_url=base_url, service_token=service_token)

    @property
    def _headers(self) -> dict[str, str]:
        return {"authorization": f"Bearer {self.service_token}"}

    async def get_agent_context(self) -> AgentContext:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/internal/ai/context",
                headers=self._headers,
            )
            response.raise_for_status()
            return AgentContext.model_validate(response.json())

    async def create_dashboard(self, message: str, public_origin: str | None) -> DashboardArtifact:
        payload: dict[str, Any] = {"message": message}
        if public_origin:
            payload["publicOrigin"] = public_origin

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/internal/ai/dashboard",
                headers=self._headers,
                json=payload,
            )
            response.raise_for_status()
            return DashboardArtifact.model_validate(response.json())
