ALTER TABLE intervention
    DROP CONSTRAINT intervention_resultat_intervention_check;

UPDATE intervention
   SET motif_exception = '[Migration 2026-10-24] Motif historique non renseigné avant la règle métier.'
 WHERE resultat_intervention IS NOT NULL
   AND resultat_intervention <> 'SUCCES_TOTAL'
   AND (motif_exception IS NULL OR length(trim(motif_exception)) < 10);

ALTER TABLE intervention
    ADD CONSTRAINT ck_intervention_resultat CHECK (
        resultat_intervention IS NULL
        OR resultat_intervention IN (
            'SUCCES_TOTAL',
            'SUCCES_PARTIEL',
            'ECHEC',
            'IMPOSSIBLE',
            'DEPOT_INTROUVABLE',
            'ACCES_IMPOSSIBLE',
            'REPORTE',
            'HORS_COMPETENCE',
            'ORIENTATION_SPECIALISEE',
            'AUTRE'
        )
    ),
    ADD CONSTRAINT ck_intervention_exception_reason CHECK (
        (resultat_intervention = 'SUCCES_TOTAL' AND motif_exception IS NULL)
        OR (
            resultat_intervention IS NOT NULL
            AND resultat_intervention <> 'SUCCES_TOTAL'
            AND motif_exception IS NOT NULL
            AND length(trim(motif_exception)) >= 10
        )
        OR (resultat_intervention IS NULL AND motif_exception IS NULL)
    );

ALTER TABLE verification_resolution
    DROP CONSTRAINT verification_resolution_resultat_verification_check;

UPDATE verification_resolution
   SET motif = '[Migration 2026-10-24] Motif historique non renseigné avant la règle métier.'
 WHERE resultat_verification <> 'CONFORME_RESOLU'
   AND (motif IS NULL OR length(trim(motif)) < 10);

ALTER TABLE verification_resolution
    ADD CONSTRAINT ck_verification_resultat CHECK (
        resultat_verification IN (
            'CONFORME_RESOLU',
            'PARTIEL_NON_RESOLU',
            'NON_CONFORME',
            'A_REVOIR'
        )
    ),
    ADD CONSTRAINT ck_verification_exception_reason CHECK (
        resultat_verification = 'CONFORME_RESOLU'
        OR (motif IS NOT NULL AND length(trim(motif)) >= 10)
    );

ALTER TABLE contenu_dossier
    ADD COLUMN origine_ajout VARCHAR(30) NOT NULL DEFAULT 'HISTORIQUE_NON_DETERMINE',
    ADD COLUMN motif_ajout TEXT;

ALTER TABLE contenu_dossier
    ALTER COLUMN origine_ajout SET DEFAULT 'AJOUT_MANUEL';

ALTER TABLE contenu_dossier
    ADD CONSTRAINT ck_contenu_dossier_origine_ajout CHECK (
        origine_ajout IN ('SIGNALEMENT', 'CREATION_DOSSIER', 'AJOUT_MANUEL', 'HISTORIQUE_NON_DETERMINE')
    ),
    ADD CONSTRAINT ck_contenu_dossier_motif_ajout CHECK (
        (origine_ajout = 'AJOUT_MANUEL' AND motif_ajout IS NOT NULL AND length(trim(motif_ajout)) >= 10)
        OR         (origine_ajout IN ('SIGNALEMENT', 'CREATION_DOSSIER', 'HISTORIQUE_NON_DETERMINE') AND motif_ajout IS NULL)
    );

ALTER TABLE photo_signalement
    ADD COLUMN date_expiration TIMESTAMPTZ NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year');

ALTER TABLE photo_intervention
    ADD COLUMN date_expiration TIMESTAMPTZ NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year');

CREATE INDEX idx_photo_signalement_expiration ON photo_signalement(date_expiration);
CREATE INDEX idx_photo_intervention_expiration ON photo_intervention(date_expiration);

CREATE OR REPLACE FUNCTION appliquer_conservation_photo_un_an() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_ajout > CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'date_ajout ne peut pas être dans le futur';
    END IF;
    NEW.date_expiration := NEW.date_ajout + INTERVAL '1 year';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conservation_photo_signalement
    BEFORE INSERT OR UPDATE OF date_ajout ON photo_signalement
    FOR EACH ROW EXECUTE FUNCTION appliquer_conservation_photo_un_an();

CREATE TRIGGER trg_conservation_photo_intervention
    BEFORE INSERT OR UPDATE OF date_ajout ON photo_intervention
    FOR EACH ROW EXECUTE FUNCTION appliquer_conservation_photo_un_an();
