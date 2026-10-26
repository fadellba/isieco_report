ALTER TABLE photo_signalement
    ADD COLUMN date_soumission_variante TIMESTAMPTZ;

ALTER TABLE photo_intervention
    ADD COLUMN date_soumission_variante TIMESTAMPTZ;

CREATE INDEX idx_photo_signalement_publication_queue
    ON photo_signalement (etat_publication, date_soumission_variante);

CREATE INDEX idx_photo_intervention_publication_queue
    ON photo_intervention (etat_publication, date_soumission_variante);
