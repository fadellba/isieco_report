CREATE OR REPLACE FUNCTION verifier_approbation_variante_photo() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.etat_publication = 'APPROUVEE' AND (
        NEW.reference_photo_publique IS NULL
        OR NEW.reference_photo_publique = NEW.reference_photo
        OR NOT NEW.floutage_confirme
        OR NEW.variante_soumise_par IS NULL
        OR NEW.date_soumission_variante IS NULL
        OR NEW.approuve_par IS NULL
        OR NEW.date_approbation IS NULL
        OR NEW.variante_soumise_par = NEW.approuve_par
    ) THEN
        RAISE EXCEPTION 'Une variante publique doit être distincte de l''original et approuvée indépendamment';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_approbation_variante_photo_signalement
    BEFORE INSERT OR UPDATE OF etat_publication, reference_photo_publique,
        floutage_confirme, variante_soumise_par, date_soumission_variante,
        approuve_par, date_approbation
    ON photo_signalement
    FOR EACH ROW EXECUTE FUNCTION verifier_approbation_variante_photo();

CREATE TRIGGER trg_approbation_variante_photo_intervention
    BEFORE INSERT OR UPDATE OF etat_publication, reference_photo_publique,
        floutage_confirme, variante_soumise_par, date_soumission_variante,
        approuve_par, date_approbation
    ON photo_intervention
    FOR EACH ROW EXECUTE FUNCTION verifier_approbation_variante_photo();

CREATE OR REPLACE FUNCTION verifier_approbation_publication() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.etat_publication IN ('APPROUVEE', 'MASQUEE') THEN
        IF NEW.id_signalement IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM signalement s
                 WHERE s.id_signalement = NEW.id_signalement
                   AND s.statut_signalement IN ('ACCEPTE_POUR_RATTACHEMENT', 'RATTACHE')
            ) OR NOT EXISTS (
                SELECT 1 FROM photo_publication pp
                 WHERE pp.id_publication = NEW.id_publication AND pp.role_photo = 'OBSERVATION'
            ) THEN
                RAISE EXCEPTION 'Une publication de signalement exige un premier contrôle et une photo approuvée';
            END IF;
        ELSIF NOT EXISTS (
            SELECT 1 FROM dossier_traitement d
             WHERE d.id_dossier = NEW.id_dossier
               AND d.statut_dossier = 'CLOS_RESOLUTION_CONFIRMEE'
        ) OR NOT EXISTS (
            SELECT 1 FROM photo_publication pp
             WHERE pp.id_publication = NEW.id_publication AND pp.role_photo = 'AVANT'
        ) OR NOT EXISTS (
            SELECT 1 FROM photo_publication pp
             WHERE pp.id_publication = NEW.id_publication AND pp.role_photo = 'APRES'
        ) THEN
            RAISE EXCEPTION 'Une publication d''opération exige une résolution vérifiée et des photos avant/après approuvées';
        END IF;
    END IF;

    IF NEW.etat_publication = 'APPROUVEE' THEN
        IF NEW.approuve_par IS NOT DISTINCT FROM NEW.cree_par THEN
            RAISE EXCEPTION 'Le créateur ne peut pas approuver sa publication';
        END IF;
        IF EXISTS (
            SELECT 1
              FROM photo_publication pp
              LEFT JOIN photo_signalement ps
                ON ps.id_photo_signalement = pp.id_photo_signalement
              LEFT JOIN photo_intervention pi
                ON pi.id_photo_intervention = pp.id_photo_intervention
             WHERE pp.id_publication = NEW.id_publication
               AND NOT (
                   (ps.id_photo_signalement IS NOT NULL
                    AND ps.etat_publication = 'APPROUVEE'
                    AND ps.floutage_confirme
                    AND ps.reference_photo_publique IS NOT NULL
                    AND ps.approuve_par IS DISTINCT FROM NEW.approuve_par)
                   OR
                   (pi.id_photo_intervention IS NOT NULL
                    AND pi.etat_publication = 'APPROUVEE'
                    AND pi.floutage_confirme
                    AND pi.reference_photo_publique IS NOT NULL
                    AND pi.approuve_par IS DISTINCT FROM NEW.approuve_par)
               )
        ) THEN
            RAISE EXCEPTION 'Toutes les photos doivent être approuvées et la modération doit rester indépendante';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
