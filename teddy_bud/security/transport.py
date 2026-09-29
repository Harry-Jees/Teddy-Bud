"""HTTPS transport with safe application-level error mapping."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class GatewayTransportError(RuntimeError):
    pass


class AuthenticationError(GatewayTransportError):
    pass


class GatewayUnavailableError(GatewayTransportError):
    pass


class ModelUnavailableError(GatewayTransportError):
    pass


class RateLimitError(GatewayTransportError):
    pass


class NetworkError(GatewayTransportError):
    pass


class GatewayTransport:
    def __init__(self, base_url: str, *, timeout: float = 30.0):
        if not base_url or not base_url.lower().startswith("https://"):
            raise ValueError("Gateway URL must use HTTPS")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def request(self, method: str, path: str, *, payload=None, token: str | None = None):
        if not path.startswith("/"):
            raise ValueError("Gateway path must be absolute")
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            return urlopen(Request(self.base_url + path, data=data, headers=headers, method=method), timeout=self.timeout)
        except HTTPError as exc:
            if exc.code in (401, 403):
                raise AuthenticationError("Gateway authentication failed") from exc
            if exc.code == 429:
                raise RateLimitError("The conversation service is busy") from exc
            if exc.code in (404, 503):
                raise ModelUnavailableError("The requested gateway service is unavailable") from exc
            raise GatewayUnavailableError("The conversation service is unavailable") from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise NetworkError("The conversation service could not be reached") from exc

    def get_json(self, path: str, *, token: str | None = None) -> dict:
        try:
            with self.request("GET", path, token=token) as response:
                return json.loads(response.read().decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise GatewayUnavailableError("The gateway returned an invalid response") from exc

    def post_json(self, path: str, payload: dict, *, token: str | None = None) -> dict:
        try:
            with self.request("POST", path, payload=payload, token=token) as response:
                return json.loads(response.read().decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise GatewayUnavailableError("The gateway returned an invalid response") from exc

