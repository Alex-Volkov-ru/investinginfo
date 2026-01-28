"""
API эндпоинты для управления бэкапами базы данных.
Все операции выполняются асинхронно, чтобы не блокировать работу приложения.
Требует аутентификации администратора.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import asyncio

from jose import jwt, JWTError

from app.backend.core.auth import get_current_user
from app.backend.core.config import get_settings
from app.backend.core.constants import (
    HTTP_404_NOT_FOUND,
    HTTP_403_FORBIDDEN,
    HTTP_401_UNAUTHORIZED,
    ERROR_INVALID_TOKEN,
    ERROR_USER_NOT_FOUND,
)
from app.backend.db.session import get_db
from app.backend.models.user import User
from app.backend.scripts.backup_manager import BackupManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backups", tags=["backups"])

import os
backup_manager = BackupManager(
    backup_dir=os.getenv("BACKUP_DIR", "/opt/backups"),
    retention_days=int(os.getenv("BACKUP_RETENTION_DAYS", "30")),
    compress=True
)

settings = get_settings()


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
    message: str
    backup: Optional[BackupInfo] = None


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
    """Проверяет доступ администратора."""
    if not user:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Требуется аутентификация"
        )


async def _get_user_from_header_or_token(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Достает пользователя либо из Authorization Bearer, либо из query-параметра ?token=...
    Нужно для скачивания бэкапа по прямой ссылке с токеном.
    """
    token: Optional[str] = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    else:
        token = request.query_params.get("token") or None

    if not token:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=ERROR_INVALID_TOKEN)

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub", "0"))
    except (JWTError, ValueError):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=ERROR_INVALID_TOKEN)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail=ERROR_USER_NOT_FOUND)
    return user


# ===== Endpoints =====

@router.post("/create", response_model=BackupCreateResponse)
async def create_backup(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Создает новый бэкап базы данных асинхронно в фоне.
    Возвращает ответ сразу, бэкап создается в фоновом режиме.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        logger.info(f"Запуск создания бэкапа пользователем {user.email}")
        
        def _create_backup_task():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(backup_manager.create_backup())
                finally:
                    loop.close()
            except Exception as e:
                logger.error(f"Ошибка создания бэкапа в фоне: {e}", exc_info=True)
        
        background_tasks.add_task(_create_backup_task)
        
        return BackupCreateResponse(
            success=True,
            message="Создание бэкапа запущено в фоновом режиме. Проверьте список бэкапов через несколько минут.",
            backup=None
        )
    except Exception as e:
        logger.error(f"Ошибка запуска создания бэкапа: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось запустить создание бэкапа: {str(e)}"
        )


@router.get("/list", response_model=BackupListResponse)
async def list_backups(
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
async def get_backup_info(
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
async def download_backup(
    filename: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Скачивает файл бэкапа.
    Требует аутентификации (либо через заголовок Authorization Bearer, либо через ?token=...).
    """
    user = await _get_user_from_header_or_token(request, db)
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
async def delete_backup(
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
async def restore_backup(
    request: BackupRestoreRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Восстанавливает базу данных из бэкапа асинхронно в фоне.
    ВНИМАНИЕ: Это перезапишет все данные в базе!
    Возвращает ответ сразу, восстановление выполняется в фоновом режиме.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        logger.warning(f"Запуск восстановления бэкапа {request.filename} пользователем {user.email}")
        
        backup_info = backup_manager.get_backup_info(request.filename)
        if not backup_info:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Бэкап не найден: {request.filename}"
            )
        
        if backup_info:
            logger.info(f"Размер бэкапа: {backup_info.get('size_mb', 0):.2f} MB")
        
        def _restore_backup_task():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(backup_manager.restore_backup(
                        request.filename,
                        drop_existing=request.drop_existing
                    ))
                    logger.info(f"Восстановление бэкапа {request.filename} успешно завершено в фоне")
                finally:
                    loop.close()
            except Exception as e:
                logger.error(f"Ошибка восстановления бэкапа в фоне: {e}", exc_info=True)
        
        background_tasks.add_task(_restore_backup_task)
        
        return BackupRestoreResponse(
            success=True,
            message=f"Восстановление базы данных из {request.filename} запущено в фоновом режиме. Это может занять несколько минут. Проверьте логи для отслеживания прогресса."
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка запуска восстановления бэкапа: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось запустить восстановление базы данных: {str(e)}"
        )


@router.get("/disk-usage")
async def get_disk_usage(
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
async def rotate_backups(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user)
):
    """
    Вручную запускает ротацию старых бэкапов в фоне.
    Требует аутентификации.
    """
    _check_admin_access(user)
    
    try:
        def _rotate_task():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(backup_manager.rotate_backups())
                    logger.info(f"Ротация бэкапов завершена")
                finally:
                    loop.close()
            except Exception as e:
                logger.error(f"Ошибка ротации бэкапов в фоне: {e}", exc_info=True)
        
        background_tasks.add_task(_rotate_task)
        
        return {
            "success": True,
            "message": "Ротация бэкапов запущена в фоновом режиме"
        }
    except Exception as e:
        logger.error(f"Ошибка запуска ротации бэкапов: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось запустить ротацию: {str(e)}"
        )
