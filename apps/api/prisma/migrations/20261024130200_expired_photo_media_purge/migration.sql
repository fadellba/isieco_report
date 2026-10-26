ALTER TABLE photo_signalement
    ADD COLUMN media_purge_at TIMESTAMPTZ;

ALTER TABLE photo_intervention
    ADD COLUMN media_purge_at TIMESTAMPTZ;

CREATE INDEX idx_photo_signalement_pending_purge
    ON photo_signalement(date_expiration)
    WHERE media_purge_at IS NULL;

CREATE INDEX idx_photo_intervention_pending_purge
    ON photo_intervention(date_expiration)
    WHERE media_purge_at IS NULL;
