CREATE TABLE IF NOT EXISTS pf.admin_obligation_risk_dismissals (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    block_id        BIGINT,
    obligation_id   BIGINT,
    dismissed_by    BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_risk_dismissal_block
    ON pf.admin_obligation_risk_dismissals (user_id, kind, block_id)
    WHERE block_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_risk_dismissal_simple
    ON pf.admin_obligation_risk_dismissals (user_id, kind, obligation_id)
    WHERE obligation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_risk_dismissals_user ON pf.admin_obligation_risk_dismissals(user_id);
