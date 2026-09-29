"""Central, non-secret application configuration.

The client has no NVIDIA credentials. NVIDIA model and key selection belongs
exclusively to the Cloudflare Worker gateway.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class AppSettings:
    environment: str
    debug: bool
    gateway_url: str | None
    database_path: Path


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings(*, data_dir: Path | None = None) -> AppSettings:
    """Load only non-secret client settings."""

    root = data_dir or Path(os.getenv("TEDDY_DATA_DIR", Path.home() / ".teddy_bud"))
    return AppSettings(
        environment=os.getenv("TEDDY_ENV", "development"),
        debug=_as_bool(os.getenv("TEDDY_DEBUG")),
        gateway_url=os.getenv("TEDDY_GATEWAY_URL") or None,
        database_path=root / "teddy_bud.sqlite3",
    )

