CREATE OR REPLACE FUNCTION verrouiller_dossier_pour_ecriture(p_id_dossier UUID)
RETURNS TEXT
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

    RETURN statut_courant;
END;
$$;

CREATE OR REPLACE FUNCTION verifier_contenu_dossier_ouvert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    statut_courant TEXT;
BEGIN
    statut_courant := verrouiller_dossier_pour_ecriture(NEW.id_dossier);

    IF NEW.etat_contenu_dossier = 'INCLUSE'
       AND statut_courant IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE') THEN
        RAISE EXCEPTION 'Une réouverture tracée est requise avant toute modification de contenu ou affectation.'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'dossier_cloture_write_guard';
    END IF;

    RETURN NEW;
END;
$$;
