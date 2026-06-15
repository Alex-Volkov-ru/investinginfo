-- Admin audit log
CREATE TABLE pf.admin_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    admin_id    BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
    action      VARCHAR(100) NOT NULL,
    target_user_id BIGINT REFERENCES pf.users(id) ON DELETE SET NULL,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created ON pf.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_admin ON pf.admin_audit_log(admin_id);

-- Global category templates for new users
CREATE TABLE pf.admin_category_templates (
    id                  BIGSERIAL PRIMARY KEY,
    kind                VARCHAR(10) NOT NULL,
    name                VARCHAR(100) NOT NULL,
    monthly_limit       NUMERIC(20, 2),
    apply_to_new_users  BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Obligation block templates
CREATE TABLE pf.admin_obligation_templates (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    total       NUMERIC(20, 2) NOT NULL DEFAULT 0,
    monthly     NUMERIC(20, 2) NOT NULL DEFAULT 0,
    rate        NUMERIC(10, 4) NOT NULL DEFAULT 0,
    due_day     INT NOT NULL DEFAULT 1,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
