import pytest

from apps.drivers.factory import get_driver
from apps.drivers.mysql import MySQLDriver
from apps.drivers.pool import PoolManager, RunTracker
from apps.drivers.postgres import PostgresDriver


def test_run_tracker_lifecycle():
    tracker = RunTracker()
    assert tracker.active_runs() == []

    info = tracker.register(
        run_id="run-1",
        connection_id="conn-1",
        engine="postgres",
        backend_id=1234,
    )
    assert info.run_id == "run-1"
    assert info.backend_id == 1234
    assert len(tracker.active_runs()) == 1

    fetched = tracker.get("run-1")
    assert fetched is not None
    assert fetched.backend_id == 1234

    removed = tracker.unregister("run-1")
    assert removed is not None
    assert tracker.get("run-1") is None
    assert len(tracker.active_runs()) == 0


def test_pool_manager_keys_and_cleanup():
    mgr = PoolManager(idle_timeout=0.01)

    key1 = mgr._pool_key({"id": "conn-uuid-1"})
    assert key1 == "conn:conn-uuid-1"

    key2 = mgr._pool_key({"host": "pg.local", "port": 5432, "db_name": "db", "username": "u", "read_only": True})
    assert "pg.local:5432/db:ro=True" in key2

    # close_all on empty manager doesn't error
    mgr.close_all()


def test_factory_get_driver():
    pg = get_driver({"engine": "postgres", "host": "h", "port": 5432, "db_name": "d", "username": "u"})
    assert isinstance(pg, PostgresDriver)

    my = get_driver({"engine": "mysql", "host": "h", "port": 3306, "db_name": "d", "username": "u"})
    assert isinstance(my, MySQLDriver)

    with pytest.raises(ValueError) as exc:
        get_driver({"engine": "sqlite", "host": "h"})
    assert "Unsupported database engine: 'sqlite'" in str(exc.value)
