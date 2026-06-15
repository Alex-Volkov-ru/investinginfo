from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.backend.models.admin import AdminAuditLog
from app.backend.models.user import User


def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_user_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    entry = AdminAuditLog(
        admin_id=admin.id,
        action=action,
        target_user_id=target_user_id,
        details=details,
    )
    db.add(entry)
    db.commit()
