ALTER TABLE photo_signalement
    ADD COLUMN media_stockee_locale BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE photo_intervention
    ADD COLUMN media_stockee_locale BOOLEAN NOT NULL DEFAULT FALSE;
