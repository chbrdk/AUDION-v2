from __future__ import annotations

import logfire
import structlog

from .config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(processors=processors, wrapper_class=structlog.make_filtering_bound_logger(20))

    if settings.logfire_token:
        logfire.configure(token=settings.logfire_token)

