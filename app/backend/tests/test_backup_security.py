import pytest

from app.backend.scripts.backup_manager import validate_backup_filename


def test_valid_backup_filename():
    assert validate_backup_filename("backup_20260615_120000.sql") == "backup_20260615_120000.sql"
    assert validate_backup_filename("backup_20260615_120000.sql.gz") == "backup_20260615_120000.sql.gz"


def test_rejects_path_traversal():
    with pytest.raises(ValueError):
        validate_backup_filename("../../../etc/passwd")

    with pytest.raises(ValueError):
        validate_backup_filename("backup_evil.sql")


def test_uses_basename_only():
    assert validate_backup_filename("subdir/backup_20260615_120000.sql") == "backup_20260615_120000.sql"
