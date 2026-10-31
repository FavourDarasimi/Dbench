from datetime import date, datetime, time, timezone
from decimal import Decimal
import uuid

import pytest

from apps.drivers.base import (
    ColumnMeta,
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
    ForeignKeyMeta,
    GenericType,
    QueryResult,
    TableMeta,
    TestResult,
    generic_type_from_name,
    serialize_value,
)


def test_meta_models_and_to_dict():
    fk = ForeignKeyMeta(
        target_schema="public",
        target_table="users",
        target_column="id",
        constraint_name="fk_users_id",
    )
    assert fk.to_dict()["target_table"] == "users"

    col = ColumnMeta(
        name="user_id",
        data_type="int4",
        generic_type="number",
        nullable=False,
        default=None,
        is_primary_key=False,
        foreign_key=fk,
    )
    col_dict = col.to_dict()
    assert col_dict["name"] == "user_id"
    assert col_dict["generic_type"] == "number"
    assert col_dict["foreign_key"]["target_column"] == "id"

    tbl = TableMeta(name="orders", schema="public", type="table", row_count_estimate=150)
    assert tbl.to_dict()["row_count_estimate"] == 150

    qr = QueryResult(
        columns=[col],
        column_names=["user_id"],
        rows=[{"user_id": 42}],
        row_count=1,
        duration_ms=12,
        truncated=False,
        total_rows=100,
    )
    qr_dict = qr.to_dict()
    assert qr_dict["row_count"] == 1
    assert qr_dict["rows"][0]["user_id"] == 42
    assert qr_dict["total_rows"] == 100

    tr = TestResult(ok=True, latency_ms=15, server_version="PostgreSQL 16")
    assert tr.to_dict()["server_version"] == "PostgreSQL 16"


def test_serialize_value():
    assert serialize_value(None) is None
    assert serialize_value(123) == 123
    assert serialize_value(12.34) == 12.34
    assert serialize_value(True) is True

    # Decimal
    assert serialize_value(Decimal("10.5")) == 10.5
    # High precision decimal preserved as str
    assert isinstance(serialize_value(Decimal("1.12345678901234567890")), str)

    # UUID
    u = uuid.uuid4()
    assert serialize_value(u) == str(u)

    # Dates and Times
    dt = datetime(2026, 10, 31, 10, 0, 0, tzinfo=timezone.utc)
    assert serialize_value(dt) == "2026-10-31T10:00:00+00:00"
    assert serialize_value(date(2026, 10, 31)) == "2026-10-31"
    assert serialize_value(time(12, 30, 45)) == "12:30:45"

    # Binary data
    b = b"hello\x00world"
    assert serialize_value(b) == "<binary data: 11 bytes>"

    # Long text truncation (PRD F21)
    long_str = "x" * 12000
    serialized_str = serialize_value(long_str)
    assert len(serialized_str) < 11000
    assert serialized_str.endswith("... [truncated]")

    # Dict and List
    d = {"key": "val", "num": 1}
    assert serialize_value(d) == d


def test_generic_type_from_name():
    assert generic_type_from_name("int4") == GenericType.NUMBER.value
    assert generic_type_from_name("BIGINT") == GenericType.NUMBER.value
    assert generic_type_from_name("decimal(10,2)") == GenericType.NUMBER.value
    assert generic_type_from_name("boolean") == GenericType.BOOLEAN.value
    assert generic_type_from_name("timestamp with time zone") == GenericType.DATETIME.value
    assert generic_type_from_name("date") == GenericType.DATE.value
    assert generic_type_from_name("time without time zone") == GenericType.TIME.value
    assert generic_type_from_name("jsonb") == GenericType.JSON.value
    assert generic_type_from_name("bytea") == GenericType.BINARY.value
    assert generic_type_from_name("uuid") == GenericType.UUID.value
    assert generic_type_from_name("varchar(255)") == GenericType.TEXT.value
    assert generic_type_from_name("custom_type_unknown") == GenericType.UNKNOWN.value


def test_driver_exception_hierarchy():
    base_err = DriverError("Base error")
    assert isinstance(base_err, Exception)

    conn_err = DriverConnectionError("Conn failed")
    assert isinstance(conn_err, DriverError)

    auth_err = DriverAuthenticationError("Auth failed")
    assert isinstance(auth_err, DriverConnectionError)

    timeout_err = DriverTimeoutError("Timeout")
    assert isinstance(timeout_err, DriverError)

    ro_err = DriverReadOnlyError("Read only")
    assert isinstance(ro_err, DriverError)

    cancel_err = DriverCancelledError("Cancelled")
    assert isinstance(cancel_err, DriverError)

    query_err = DriverQueryError("Query failed")
    assert isinstance(query_err, DriverError)
