"""Consistent API error response helpers and exception handlers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("rams.api")


def error_body(
    *,
    code: str,
    message: str,
    details: Any = None,
) -> dict[str, Any]:
    """Build a uniform error payload while keeping FastAPI-style `detail`."""
    body: dict[str, Any] = {
        "detail": message,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        body["error"]["details"] = details
    return body


def http_error(
    status_code: int,
    message: str,
    *,
    code: str | None = None,
    headers: dict[str, str] | None = None,
) -> HTTPException:
    """Raise HTTPException with a stable message (and optional error code via handler)."""
    return HTTPException(
        status_code=status_code,
        detail=message,
        headers=headers,
    )


def _status_to_code(status_code: int) -> str:
    mapping = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        429: "rate_limited",
        500: "internal_error",
        503: "service_unavailable",
    }
    return mapping.get(status_code, f"http_{status_code}")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, str):
            message = detail
            details = None
        else:
            message = "Request failed"
            details = detail
        body = error_body(
            code=_status_to_code(exc.status_code),
            message=message,
            details=details,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=body,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = []
        for err in exc.errors():
            loc = ".".join(str(part) for part in err.get("loc", ()) if part != "body")
            errors.append(
                {
                    "field": loc or None,
                    "message": err.get("msg", "Invalid value"),
                    "type": err.get("type"),
                }
            )
        message = "Request validation failed"
        body = error_body(
            code="validation_error",
            message=message,
            details=errors,
        )
        # Keep FastAPI-compatible detail for clients that expect a list
        body["detail"] = errors
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=body,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception(
            "Unhandled error on %s %s: %s",
            request.method,
            request.url.path,
            exc,
        )
        body = error_body(
            code="internal_error",
            message="An unexpected error occurred. Please try again later.",
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=body,
        )
