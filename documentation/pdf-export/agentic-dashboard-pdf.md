# Agentic Dashboard PDF Export

## Recommendation

Use a server-side print pipeline for high-fidelity dashboard PDFs:

1. Accept a strict JSON dashboard document contract.
2. Normalize and validate the contract before rendering.
3. Render charts as ECharts SVG on the server.
4. Run an adaptive layout pass that chooses module widths, heights, and page breaks for A4 landscape.
5. Print deterministic HTML with Playwright/Chromium using `printBackground` and `preferCSSPageSize`.

This should be the canonical exporter for automated and agent-created reports. The existing browser-side `html2canvas` + `jsPDF` exporter can remain as a quick manual capture path, but it should not be the source of truth for complex dashboards because it rasterizes the whole dashboard and slices screenshots across pages.

## Why This Fits Agents

A Pydantic AI agent can expose one tool that POSTs validated JSON to `/api/pdf/dashboard`. The agent does not need DOM access or a logged-in browser session. The API is deterministic: the same payload returns the same report layout except for explicitly supplied timestamps.

Minimal Pydantic shape:

```python
from pydantic import BaseModel, Field

class Series(BaseModel):
    field: str
    label: str | None = None
    color: str | None = None

class Module(BaseModel):
    type: str = Field(pattern='^(line|bar|horizontal_bar|pie|kpi|table|text)$')
    title: str | None = None
    data: list[dict] = []
    xField: str | None = None
    yFields: list[Series] | None = None
    categoryField: str | None = None
    valueField: str | None = None
    value: str | float | int | None = None
    width: str | None = Field(default=None, pattern='^(third|half|full)$')

class DashboardPdf(BaseModel):
    title: str
    subtitle: str | None = None
    generatedAt: str | None = None
    modules: list[Module]
```

## Current Implementation

- `GET /pdf/test-dashboard` renders the deterministic HTML preview used by tests.
- `GET /api/pdf/test-dashboard` returns a PDF for the synthetic dashboard.
- `POST /api/pdf/dashboard` accepts a dashboard JSON payload and returns `application/pdf`.
- Chart output is vector SVG from ECharts SSR, so charts stay sharp in the PDF.
- The layout optimizer uses estimated module complexity to choose card dimensions and first-fit page packing for A4 landscape.

## Next Production Hardening

- Move Playwright/Chromium into a dedicated PDF worker container for isolation and concurrency control.
- Add per-tenant rate limits and queueing for large agent-generated reports.
- Persist export requests and generated files if auditability is required.
- Extend the JSON contract with dashboard theme, page orientation, logo, and chart-specific option overrides.
