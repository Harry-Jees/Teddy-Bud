"""AI service facade: route locally, call only the Cloudflare gateway."""

from __future__ import annotations

from teddy_bud.ai.models import AIRequest, AIResponse
from teddy_bud.ai.providers.cloudflare import CloudflareGatewayProvider
from teddy_bud.ai.router import AIRouter
from teddy_bud.ai.schemas import AIResponseError, StructuredResponse, parse_structured_response


class AIService:
    def __init__(self, provider: CloudflareGatewayProvider, router: AIRouter | None = None):
        self.provider = provider
        self.router = router or AIRouter()

    def complete(self, request: AIRequest) -> AIResponse:
        route = self.router.route(request)
        return self.provider.complete(request, route)

    def complete_structured(self, request: AIRequest, *, fallback: StructuredResponse) -> StructuredResponse:
        for attempt in range(2):
            try:
                return parse_structured_response(self.complete(request).text)
            except AIResponseError:
                if attempt == 1:
                    return fallback
        return fallback

