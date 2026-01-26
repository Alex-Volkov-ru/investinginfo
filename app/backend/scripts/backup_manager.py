"""
Менеджер бэкапов базы данных PostgreSQL.
Создает, удаляет, восстанавливает бэкапы с автоматическим сжатием и ротацией.
"""

import os
import gzip
import shutil
import subprocess
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List
import logging
from urllib.parse import urlparse

from app.backend.core.config import get_settings

logger = logging.getLogger(__name__)

class BackupManager:
    """Управление бэкапами базы данных."""
    
    def __init__(
        self,
        backup_dir: Optional[str] = None,
        retention_days: int = 30,
        compress: bool = True
    ):
        """
        Args:
            backup_dir: Директория для хранения бэкапов (по умолчанию /opt/backups)
            retention_days: Количество дней хранения бэкапов
            compress: Сжимать ли бэкапы (gzip)
        """
        self.settings = get_settings()
        self.backup_dir = Path(backup_dir or os.getenv("BACKUP_DIR", "/opt/backups"))
        self.retention_days = retention_days
        self.compress = compress
        
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        self._parse_database_url()
    
    def _parse_database_url(self):
        """Парсит DATABASE_URL для получения параметров подключения из .env."""
        db_url = str(self.settings.DATABASE_URL)
        
        clean_url = db_url.replace("postgresql+psycopg2://", "postgresql://").replace("postgresql://", "postgresql://")
        
        if not clean_url.startswith("postgresql://"):
            raise ValueError(f"Неподдерживаемый тип БД в DATABASE_URL: {db_url}")
        
        parsed = urlparse(clean_url)
        
        self.db_user = parsed.username or os.getenv("POSTGRES_USER", "bigs")
        self.db_password = parsed.password or os.getenv("POSTGRES_PASSWORD", "")
        self.db_host = parsed.hostname or os.getenv("POSTGRES_HOST", "db")
        self.db_port = str(parsed.port) if parsed.port else os.getenv("POSTGRES_PORT", "5432")
        self.db_name = parsed.path.lstrip("/") if parsed.path else os.getenv("POSTGRES_DB", "bigsdb")
        
        logger.debug(f"Параметры БД из DATABASE_URL: host={self.db_host}, port={self.db_port}, user={self.db_user}, db={self.db_name}")
    
    def _get_backup_filename(self, timestamp: Optional[datetime] = None) -> str:
        """Генерирует имя файла бэкапа с временной меткой."""
        if timestamp is None:
            timestamp = datetime.now()
        date_str = timestamp.strftime("%Y%m%d_%H%M%S")
        ext = ".sql.gz" if self.compress else ".sql"
        return f"backup_{date_str}{ext}"
    
    def _get_metadata_filename(self, backup_filename: str) -> str:
        """Генерирует имя файла метаданных."""
        return backup_filename.replace(".sql.gz", ".json").replace(".sql", ".json")
    
    def create_backup(self) -> Dict[str, any]:
        """
        Создает бэкап базы данных.
        
        Returns:
            Dict с информацией о созданном бэкапе:
            {
                "filename": str,
                "path": str,
                "size": int (bytes),
                "size_compressed": int (bytes) if compressed,
                "created_at": str (ISO format),
                "metadata_path": str
            }
        """
        timestamp = datetime.now()
        backup_filename = self._get_backup_filename(timestamp)
        backup_path = self.backup_dir / backup_filename
        metadata_filename = self._get_metadata_filename(backup_filename)
        metadata_path = self.backup_dir / metadata_filename
        
        logger.info(f"Создание бэкапа: {backup_filename}")
        
        try:
            env = os.environ.copy()
            env["PGPASSWORD"] = self.db_password
            
            cmd = [
                "pg_dump",
                "-h", self.db_host,
                "-p", str(self.db_port),
                "-U", self.db_user,
                "-d", self.db_name,
                "--clean",
                "--if-exists",
                "--format", "plain",
                "--encoding", "UTF8",
                "--no-owner",
                "--no-privileges",
            ]
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env
            )
            
            if self.compress:
                with gzip.open(backup_path, "wb") as f:
                    shutil.copyfileobj(process.stdout, f)
            else:
                with open(backup_path, "wb") as f:
                    shutil.copyfileobj(process.stdout, f)
            
            stdout, stderr = process.communicate()
            
            if stderr:
                stderr = stderr.decode("utf-8", errors="replace")
            
            if process.returncode != 0:
                raise subprocess.CalledProcessError(
                    process.returncode,
                    cmd,
                    stdout,
                    stderr
                )
            
            size = backup_path.stat().st_size
            
            metadata = {
                "filename": backup_filename,
                "created_at": timestamp.isoformat(),
                "size_bytes": size,
                "size_mb": round(size / (1024 * 1024), 2),
                "database": self.db_name,
                "host": self.db_host,
                "compressed": self.compress,
                "retention_days": self.retention_days
            }
            
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Бэкап создан: {backup_filename} ({metadata['size_mb']} MB)")
            
            self.rotate_backups()
            
            return {
                "filename": backup_filename,
                "path": str(backup_path),
                "size": size,
                "size_mb": metadata["size_mb"],
                "created_at": metadata["created_at"],
                "metadata_path": str(metadata_path),
                "compressed": self.compress
            }
            
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode("utf-8", errors="replace") if isinstance(e.stderr, bytes) else str(e.stderr)
            logger.error(f"Ошибка создания бэкапа: {error_msg}")
            raise RuntimeError(f"Не удалось создать бэкап: {error_msg}")
        except Exception as e:
            logger.error(f"Неожиданная ошибка при создании бэкапа: {e}")
            if backup_path.exists():
                backup_path.unlink()
            raise
    
    def list_backups(self) -> List[Dict[str, any]]:
        """
        Возвращает список всех бэкапов с метаданными.
        
        Returns:
            List[Dict] с информацией о каждом бэкапе
        """
        backups = []
        
        for file_path in self.backup_dir.glob("backup_*.sql*"):
            if file_path.suffix == ".gz" or file_path.suffix == ".sql":
                metadata_path = self._get_metadata_filename(file_path.name)
                metadata_file = self.backup_dir / metadata_path
                
                metadata = {}
                if metadata_file.exists():
                    try:
                        with open(metadata_file, "r", encoding="utf-8") as f:
                            metadata = json.load(f)
                    except Exception as e:
                        logger.warning(f"Не удалось загрузить метаданные для {file_path.name}: {e}")
                
                if not metadata:
                    stat = file_path.stat()
                    metadata = {
                        "filename": file_path.name,
                        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "size_bytes": stat.st_size,
                        "size_mb": round(stat.st_size / (1024 * 1024), 2),
                        "compressed": file_path.suffix == ".gz"
                    }
                
                backups.append({
                    "filename": file_path.name,
                    "path": str(file_path),
                    "size": metadata.get("size_bytes", file_path.stat().st_size),
                    "size_mb": metadata.get("size_mb", round(file_path.stat().st_size / (1024 * 1024), 2)),
                    "created_at": metadata.get("created_at"),
                    "compressed": metadata.get("compressed", file_path.suffix == ".gz")
                })
        
        backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return backups
    
    def get_backup_info(self, filename: str) -> Optional[Dict[str, any]]:
        """
        Получает информацию о конкретном бэкапе.
        
        Args:
            filename: Имя файла бэкапа
            
        Returns:
            Dict с информацией о бэкапе или None если не найден
        """
        backup_path = self.backup_dir / filename
        
        if not backup_path.exists():
            return None
        
        metadata_path = self._get_metadata_filename(filename)
        metadata_file = self.backup_dir / metadata_path
        
        metadata = {}
        if metadata_file.exists():
            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
            except Exception as e:
                logger.warning(f"Не удалось загрузить метаданные: {e}")
        
        stat = backup_path.stat()
        
        return {
            "filename": filename,
            "path": str(backup_path),
            "size": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": metadata.get("created_at", datetime.fromtimestamp(stat.st_mtime).isoformat()),
            "compressed": metadata.get("compressed", filename.endswith(".gz")),
            "exists": True
        }
    
    def delete_backup(self, filename: str) -> bool:
        """
        Удаляет бэкап и его метаданные.
        
        Args:
            filename: Имя файла бэкапа
            
        Returns:
            True если удален успешно, False если не найден
        """
        backup_path = self.backup_dir / filename
        metadata_path = self._get_metadata_filename(filename)
        metadata_file = self.backup_dir / metadata_path
        
        deleted = False
        
        if backup_path.exists():
            backup_path.unlink()
            deleted = True
            logger.info(f"Удален бэкап: {filename}")
        
        if metadata_file.exists():
            metadata_file.unlink()
        
        return deleted
    
    def rotate_backups(self) -> int:
        """
        Удаляет бэкапы старше retention_days дней.
        
        Returns:
            Количество удаленных бэкапов
        """
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        deleted_count = 0
        
        for file_path in self.backup_dir.glob("backup_*.sql*"):
            if file_path.suffix in [".gz", ".sql"]:
                try:
                    date_str = file_path.stem.replace("backup_", "").replace(".sql", "")
                    if len(date_str) >= 15:
                        file_date = datetime.strptime(date_str[:15], "%Y%m%d_%H%M%S")
                    else:
                        file_date = datetime.fromtimestamp(file_path.stat().st_mtime)
                except Exception:
                    file_date = datetime.fromtimestamp(file_path.stat().st_mtime)
                
                if file_date < cutoff_date:
                    self.delete_backup(file_path.name)
                    deleted_count += 1
        
        if deleted_count > 0:
            logger.info(f"Удалено старых бэкапов: {deleted_count}")
        
        return deleted_count
    
    def restore_backup(self, filename: str, drop_existing: bool = False) -> bool:
        """
        Восстанавливает базу данных из бэкапа.
        
        Args:
            filename: Имя файла бэкапа
            drop_existing: Удалить ли существующую БД перед восстановлением
            
        Returns:
            True если восстановление успешно
        """
        backup_path = self.backup_dir / filename
        
        if not backup_path.exists():
            raise FileNotFoundError(f"Бэкап не найден: {filename}")
        
        logger.info(f"Восстановление из бэкапа: {filename}")
        
        try:
            env = os.environ.copy()
            env["PGPASSWORD"] = self.db_password
            
            if drop_existing:
                logger.info("Очистка существующих данных...")
                cleanup_cmd = [
                    "psql",
                    "-h", self.db_host,
                    "-p", str(self.db_port),
                    "-U", self.db_user,
                    "-d", self.db_name,
                    "-c", "SET session_replication_role = 'replica'; TRUNCATE TABLE pf.budget_transactions, pf.budget_accounts, pf.budget_categories, pf.budget_obligations, pf.obligation_blocks, pf.obligation_payments, pf.portfolios, pf.positions, pf.trades, pf.cash_movements, pf.watchlist, pf.api_tokens, pf.users CASCADE; SET session_replication_role = 'origin';"
                ]
                subprocess.run(cleanup_cmd, env=env, capture_output=True, text=True, check=False)
            
            import tempfile
            with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, encoding="utf-8") as restore_file:
                restore_file_path = restore_file.name
                restore_file.write("SET session_replication_role = 'replica';\n")
                restore_file.write("\n")
                
                if filename.endswith(".gz"):
                    with gzip.open(backup_path, "rt", encoding="utf-8") as gz_file:
                        shutil.copyfileobj(gz_file, restore_file)
                else:
                    with open(backup_path, "r", encoding="utf-8") as orig_file:
                        shutil.copyfileobj(orig_file, restore_file)
                
                restore_file.write("\n")
                restore_file.write("SET session_replication_role = 'origin';\n")
            
            cmd = [
                "psql",
                "-h", self.db_host,
                "-p", str(self.db_port),
                "-U", self.db_user,
                "-d", self.db_name,
                "-v", "ON_ERROR_STOP=0",
                "-f", restore_file_path
            ]
            
            process = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                check=False
            )
            
            if os.path.exists(restore_file_path):
                os.unlink(restore_file_path)
            
            if process.returncode != 0:
                stderr_lower = process.stderr.lower() if process.stderr else ""
                if "fatal" in stderr_lower or "connection" in stderr_lower:
                    raise subprocess.CalledProcessError(
                        process.returncode,
                        cmd,
                        process.stdout,
                        process.stderr
                    )
                else:
                    logger.warning(f"Восстановление завершено с предупреждениями: {process.stderr[:200]}")
            
            logger.info(f"База данных восстановлена из: {filename}")
            return True
            
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr if isinstance(e.stderr, str) else e.stderr.decode("utf-8", errors="replace") if e.stderr else "Unknown error"
            logger.error(f"Ошибка восстановления: {error_msg}")
            raise RuntimeError(f"Не удалось восстановить базу данных: {error_msg}")
        except Exception as e:
            logger.error(f"Неожиданная ошибка при восстановлении: {e}")
            raise
    
    def get_disk_usage(self) -> Dict[str, any]:
        """
        Получает информацию об использовании диска для директории бэкапов.
        
        Returns:
            Dict с информацией о диске
        """
        total_size = sum(f.stat().st_size for f in self.backup_dir.glob("backup_*.sql*") if f.is_file())
        backup_count = len(list(self.backup_dir.glob("backup_*.sql*")))
        
        stat = shutil.disk_usage(self.backup_dir)
        
        return {
            "backup_dir": str(self.backup_dir),
            "backup_count": backup_count,
            "backup_total_size_mb": round(total_size / (1024 * 1024), 2),
            "disk_total_gb": round(stat.total / (1024 * 1024 * 1024), 2),
            "disk_used_gb": round(stat.used / (1024 * 1024 * 1024), 2),
            "disk_free_gb": round(stat.free / (1024 * 1024 * 1024), 2),
            "disk_usage_percent": round((stat.used / stat.total) * 100, 2)
        }

