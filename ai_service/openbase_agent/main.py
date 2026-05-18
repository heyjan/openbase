from __future__ import annotations

import os

from fastapi import Depends, FastAPI, Header, HTTPException

from .agent import run_chat
from .models import ChatRequest, ChatResponse

app = FastAPI(title="Openbase AI Agent", version="0.1.0")


def require_service_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("OPENBASE_AI_SERVICE_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="OPENBASE_AI_SERVICE_TOKEN is not configured")
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(require_service_token)])
async def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    return await run_chat(message, request.publicOrigin)
