from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Any
import uuid


class GenericType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    TIME = "time"
    JSON = "json"
    BINARY = "binary"
    UUID = "uuid"
    UNKNOWN = "unknown"


@dataclass
class ForeignKeyMeta:
    target_schema: str
    target_table: str
    target_column: str
    constraint_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ColumnMeta:
    name: str
    data_type: str
    generic_type: str
    nullable: bool = True
    default: str | None = None
    is_primary_key: bool = False
    foreign_key: ForeignKeyMeta | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        if self.foreign_key:
            d["foreign_key"] = self.foreign_key.to_dict()
        return d


@dataclass
class TableMeta:
    name: str
    schema: str
    type: str = "table"  # "table" | "view"
    row_count_estimate: int | None = None
    comment: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class QueryResult:
    columns: list[ColumnMeta]
    column_names: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    duration_ms: int
    truncated: bool = False
    total_rows: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "columns": [c.to_dict() for c in self.columns],
            "column_names": self.column_names,
            "rows": self.rows,
            "row_count": self.row_count,
            "duration_ms": self.duration_ms,
            "truncated": self.truncated,
            "total_rows": self.total_rows,
        }


@dataclass
class TestResult:
    __test__ = False
    ok: bool
    error: str | None = None
    latency_ms: int | None = None
    server_version: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ---- Driver Exceptions ----


class DriverError(Exception):
    """Base exception for all database driver operations."""

    def __init__(self, message: str, original_exception: Exception | None = None):
        super().__init__(message)
        self.original_exception = original_exception


class DriverConnectionError(DriverError):
    """Network, host, port, or socket failure when connecting."""


class DriverAuthenticationError(DriverConnectionError):
    """User authentication failed."""


class DriverTimeoutError(DriverError):
    """Query or connection execution exceeded the configured timeout."""


class DriverReadOnlyError(DriverError):
    """Mutation attempted on a read-only connection or transaction."""


class DriverCancelledError(DriverError):
    """Query was cancelled by the user."""


class DriverQueryError(DriverError):
    """Syntax error, missing table/column, or invalid SQL command."""


# ---- Value Serialization Helpers ----


def serialize_value(val: Any, max_text_len: int = 10000) -> Any:
    """Serialize database values into JSON-safe formats and truncate large values (PRD F21)."""
    if val is None:
        return None
    if isinstance(val, (int, float, bool)):
        return val
    if isinstance(val, Decimal):
        exp = val.as_tuple().exponent
        if isinstance(exp, int) and -6 <= exp <= 6:
            return float(val)
        return str(val)
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (bytes, bytearray, memoryview)):
        return f"<binary data: {len(val)} bytes>"
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if isinstance(val, (dict, list)):
        try:
            return json.loads(json.dumps(val, default=str))
        except Exception:
            return str(val)
    # String or other types
    s = str(val)
    if len(s) > max_text_len:
        return s[:max_text_len] + "... [truncated]"
    return s


# ---- Generic Type Mapping Helper ----


def generic_type_from_name(data_type: str) -> str:
    """Normalize engine-specific data types to generic types."""
    dt = data_type.lower().strip()
    if any(k in dt for k in ("int", "serial", "float", "double", "decimal", "numeric", "real")):
        return GenericType.NUMBER.value
    if any(k in dt for k in ("bool", "boolean")):
        return GenericType.BOOLEAN.value
    if any(k in dt for k in ("timestamp", "datetime")):
        return GenericType.DATETIME.value
    if "date" in dt:
        return GenericType.DATE.value
    if "time" in dt:
        return GenericType.TIME.value
    if any(k in dt for k in ("json", "jsonb")):
        return GenericType.JSON.value
    if any(k in dt for k in ("bytea", "blob", "binary")):
        return GenericType.BINARY.value
    if "uuid" in dt:
        return GenericType.UUID.value
    if any(k in dt for k in ("char", "text", "string", "character")):
        return GenericType.TEXT.value
    return GenericType.UNKNOWN.value


# ---- Base Driver ABC ----


class BaseDriver(ABC):
    """Abstract Base Class for all target database drivers."""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.engine = config.get("engine", "")
        self.host = config.get("host", "")
        self.port = int(config.get("port") or 5432)
        self.db_name = config.get("db_name", "")
        self.username = config.get("username", "")
        self.password = config.get("password", "")
        self.ssl_mode = config.get("ssl_mode", "prefer")
        self.read_only = bool(config.get("read_only", False))
        self.ssh_config = config.get("ssh_config") or {}

    @abstractmethod
    def test_connection(self) -> TestResult:
        """Test database connectivity, returning latency and server version."""

    @abstractmethod
    def execute(
        self,
        sql: str,
        params: tuple | list | dict | None = None,
        limit: int = 1000,
        timeout: int = 30,
        run_id: str | None = None,
    ) -> QueryResult:
        """Execute SQL with timeout, row limit, and run tracking."""

    @abstractmethod
    def list_schemas(self) -> list[str]:
        """List non-system schema names."""

    @abstractmethod
    def list_tables(self, schema: str) -> list[TableMeta]:
        """List tables and views in a given schema."""

    @abstractmethod
    def describe_table(self, schema: str, table: str) -> list[ColumnMeta]:
        """Introspect column types, primary keys, and foreign keys for a table."""

    @abstractmethod
    def cancel(self, run_id: str) -> bool:
        """Cancel a running query given its run_id."""

    @abstractmethod
    def close(self):
        """Clean up open resources, connections, or tunnels."""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
