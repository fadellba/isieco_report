CREATE OR REPLACE FUNCTION verifier_dossier_ouvert(p_id_dossier UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    statut_courant TEXT;
BEGIN
    SELECT statut_dossier
      INTO statut_courant
      FROM dossier_traitement
     WHERE id_dossier = p_id_dossier
     FOR UPDATE;

    IF statut_courant IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE') THEN
        RAISE EXCEPTION 'Une réouverture tracée est requise avant toute modification de contenu ou affectation.'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'dossier_cloture_write_guard';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION verifier_contenu_dossier_ouvert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.etat_contenu_dossier IS DISTINCT FROM 'INCLUSE' THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM verifier_dossier_ouvert(NEW.id_dossier);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION verifier_affectation_dossier_ouvert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM verifier_dossier_ouvert(NEW.id_dossier);
    RETURN NEW;
END;
$$;

CREATE TRIGGER contenu_dossier_open_parent_before_write
BEFORE INSERT OR UPDATE OF etat_contenu_dossier ON contenu_dossier
FOR EACH ROW
EXECUTE FUNCTION verifier_contenu_dossier_ouvert();

CREATE TRIGGER affectation_open_parent_before_insert
BEFORE INSERT ON affectation
FOR EACH ROW
EXECUTE FUNCTION verifier_affectation_dossier_ouvert();
