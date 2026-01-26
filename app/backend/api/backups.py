"""
API эндпоинты для управления бэкапами базы данных.
Требует аутентификации администратора (можно расширить проверкой ролей).
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.backend.core.auth import get_current_user
from app.backend.core.constants import (
    HTTP_404_NOT_FOUND,
    HTTP_403_FORBIDDEN,
    ERROR_NOT_FOUND,
)
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.scripts.backup_manager import BackupManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backups", tags=["backups"])

# Инициализируем менеджер бэкапов
import os
backup_manager = BackupManager(
    backup_dir=os.getenv("BACKUP_DIR", "/opt/backups"),  # Будет из env или /opt/backups
    retention_days=int(os.getenv("BACKUP_RETENTION_DAYS", "30")),
    compress=True
)


# ===== Schemas =====

class BackupInfo(BaseModel):
    """Информация о бэкапе."""
    filename: str
    path: str
    size: int
    size_mb: float
    created_at: Optional[str] = None
    compressed: bool = False


class BackupCreateResponse(BaseModel):
    """Ответ при создании бэкапа."""
    success: bool
    backup: BackupInfo
    message: str


class BackupListResponse(BaseModel):
    """Список бэкапов."""
    backups: List[BackupInfo]
    total: int
    disk_usage: dict


class BackupDeleteResponse(BaseModel):
    """Ответ при удалении бэкапа."""
    success: bool
    message: str


class BackupRestoreRequest(BaseModel):
    """Запрос на восстановление."""
    filename: str
    drop_existing: bool = False


class BackupRestoreResponse(BaseModel):
    """Ответ при восстановлении."""
    success: bool
    message: str


# ===== Helpers =====

def _check_admin_access(user: User) -> None:
    """
    Проверяет доступ администратора.
    Пока проверяем только наличие пользователя, можно расширить проверкой ролей.
    """
    # TODO: Добавить проверку роли администратора
    if not user:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Требуется аутентификация"
        )


# ===== Endpoints =====

@router.post("/create", response_model=BackupCreateResponse)
def create_backup(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Создает новый бэкап базы данных.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        logger.info(f"Создание бэкапа пользователем {user.email}")
        backup_info = backup_manager.create_backup()
        
        return BackupCreateResponse(
            success=True,
            backup=BackupInfo(**backup_info),
            message=f"Бэкап успешно создан: {backup_info['filename']}"
        )
    except Exception as e:
        logger.error(f"Ошибка создания бэкапа: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось создать бэкап: {str(e)}"
        )


@router.get("/list", response_model=BackupListResponse)
def list_backups(
    user: User = Depends(get_current_user)
):
    """
    Возвращает список всех доступных бэкапов.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        backups = backup_manager.list_backups()
        disk_usage = backup_manager.get_disk_usage()
        
        return BackupListResponse(
            backups=[BackupInfo(**b) for b in backups],
            total=len(backups),
            disk_usage=disk_usage
        )
    except Exception as e:
        logger.error(f"Ошибка получения списка бэкапов: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось получить список бэкапов: {str(e)}"
        )


@router.get("/info/{filename}", response_model=BackupInfo)
def get_backup_info(
    filename: str,
    user: User = Depends(get_current_user)
):
    """
    Получает информацию о конкретном бэкапе.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    backup_info = backup_manager.get_backup_info(filename)
    
    if not backup_info:
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND,
            detail=f"Бэкап не найден: {filename}"
        )
    
    return BackupInfo(**backup_info)


@router.get("/download/{filename}")
def download_backup(
    filename: str,
    user: User = Depends(get_current_user)
):
    """
    Скачивает файл бэкапа.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    backup_info = backup_manager.get_backup_info(filename)
    
    if not backup_info:
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND,
            detail=f"Бэкап не найден: {filename}"
        )
    
    backup_path = backup_manager.backup_dir / filename
    
    if not backup_path.exists():
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND,
            detail=f"Файл бэкапа не найден: {filename}"
        )
    
    return FileResponse(
        path=str(backup_path),
        filename=filename,
        media_type="application/gzip" if filename.endswith(".gz") else "application/sql"
    )


@router.delete("/delete/{filename}", response_model=BackupDeleteResponse)
def delete_backup(
    filename: str,
    user: User = Depends(get_current_user)
):
    """
    Удаляет бэкап.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        deleted = backup_manager.delete_backup(filename)
        
        if not deleted:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Бэкап не найден: {filename}"
            )
        
        return BackupDeleteResponse(
            success=True,
            message=f"Бэкап успешно удален: {filename}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка удаления бэкапа: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось удалить бэкап: {str(e)}"
        )


@router.post("/restore", response_model=BackupRestoreResponse)
def restore_backup(
    request: BackupRestoreRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Восстанавливает базу данных из бэкапа.
    ⚠️ ВНИМАНИЕ: Это перезапишет все данные в базе!
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        logger.warning(f"Восстановление бэкапа {request.filename} пользователем {user.email}")
        
        success = backup_manager.restore_backup(
            request.filename,
            drop_existing=request.drop_existing
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось восстановить базу данных"
            )
        
        return BackupRestoreResponse(
            success=True,
            message=f"База данных успешно восстановлена из: {request.filename}"
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка восстановления бэкапа: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось восстановить базу данных: {str(e)}"
        )


@router.get("/disk-usage")
def get_disk_usage(
    user: User = Depends(get_current_user)
):
    """
    Получает информацию об использовании диска для бэкапов.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        return backup_manager.get_disk_usage()
    except Exception as e:
        logger.error(f"Ошибка получения информации о диске: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось получить информацию о диске: {str(e)}"
        )


@router.post("/rotate")
def rotate_backups(
    user: User = Depends(get_current_user)
):
    """
    Вручную запускает ротацию старых бэкапов.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        deleted_count = backup_manager.rotate_backups()
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Удалено старых бэкапов: {deleted_count}"
        }
    except Exception as e:
        logger.error(f"Ошибка ротации бэкапов: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось выполнить ротацию: {str(e)}"
        )

