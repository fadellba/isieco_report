UPDATE contenu_dossier AS contenu
SET date_attente_equipe = NULL,
    motif_attente_equipe = NULL
WHERE contenu.etat_prise_en_charge = 'EN_ATTENTE_EQUIPE'
  AND EXISTS (
      SELECT 1
      FROM affectation AS affectation
      WHERE affectation.id_dossier = contenu.id_dossier
        AND affectation.id_type_dechet = contenu.id_type_dechet
        AND affectation.date_fin_affectation IS NULL
  );

UPDATE contenu_dossier AS contenu
SET etat_prise_en_charge = CASE
    WHEN contenu.etat_contenu_dossier <> 'INCLUSE' THEN contenu.etat_prise_en_charge
    WHEN EXISTS (
        SELECT 1
        FROM affectation AS affectation
        JOIN intervention AS intervention USING (id_affectation)
        WHERE affectation.id_dossier = contenu.id_dossier
          AND affectation.id_type_dechet = contenu.id_type_dechet
          AND affectation.date_fin_affectation IS NULL
          AND affectation.etat_affectation = 'A_VERIFIER'
          AND intervention.statut_intervention = 'TERMINEE'
    ) THEN 'A_VERIFIER'
    WHEN EXISTS (
        SELECT 1
        FROM affectation AS affectation
        JOIN intervention AS intervention USING (id_affectation)
        WHERE affectation.id_dossier = contenu.id_dossier
          AND affectation.id_type_dechet = contenu.id_type_dechet
          AND affectation.date_fin_affectation IS NULL
          AND affectation.etat_affectation = 'ACTIVE'
          AND intervention.statut_intervention = 'EN_COURS'
    ) THEN 'EN_COURS'
    WHEN EXISTS (
        SELECT 1
        FROM affectation AS affectation
        WHERE affectation.id_dossier = contenu.id_dossier
          AND affectation.id_type_dechet = contenu.id_type_dechet
          AND affectation.date_fin_affectation IS NULL
          AND affectation.etat_affectation = 'ACTIVE'
    ) THEN 'AFFECTEE'
    WHEN EXISTS (
        SELECT 1
        FROM affectation AS affectation
        JOIN verification_resolution AS verification
          ON verification.id_affectation = affectation.id_affectation
        WHERE affectation.id_dossier = contenu.id_dossier
          AND affectation.id_type_dechet = contenu.id_type_dechet
          AND affectation.etat_affectation = 'TERMINEE'
          AND verification.etat_verification = 'COURANTE'
          AND verification.resultat_verification = 'CONFORME_RESOLU'
          AND verification.date_verification > affectation.date_heure_affectation
          AND NOT EXISTS (
              SELECT 1
              FROM affectation AS plus_recente
              WHERE plus_recente.id_dossier = contenu.id_dossier
                AND plus_recente.id_type_dechet = contenu.id_type_dechet
                AND plus_recente.date_heure_affectation > affectation.date_heure_affectation
          )
          AND NOT EXISTS (
              SELECT 1
              FROM evenement_metier AS reouverture
              WHERE reouverture.id_dossier_cible = contenu.id_dossier
                AND reouverture.type_evenement = 'DOSSIER_REOUVERT'
                AND reouverture.date_enregistrement > affectation.date_heure_affectation
          )
    ) THEN 'TERMINEE'
    WHEN contenu.etat_prise_en_charge = 'EN_ATTENTE_EQUIPE' THEN 'EN_ATTENTE_EQUIPE'
    ELSE 'A_AFFECTER'
END;

CREATE OR REPLACE FUNCTION recalculer_statut_dossier(p_id_dossier UUID)
RETURNS VARCHAR(30)
LANGUAGE plpgsql
AS $$
DECLARE
    v_statut_courant VARCHAR(30);
    v_statut_calcule VARCHAR(30);
    v_nombre_volets INTEGER;
    v_a_affecter BOOLEAN;
    v_en_cours BOOLEAN;
    v_a_verifier BOOLEAN;
BEGIN
    SELECT dossier.statut_dossier
    INTO v_statut_courant
    FROM dossier_traitement AS dossier
    WHERE dossier.id_dossier = p_id_dossier
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF v_statut_courant IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE') THEN
        RETURN v_statut_courant;
    END IF;

    SELECT
        COUNT(*)::INTEGER,
        COALESCE(BOOL_OR(contenu.etat_prise_en_charge IN ('A_AFFECTER', 'EN_ATTENTE_EQUIPE')), FALSE),
        COALESCE(BOOL_OR(contenu.etat_prise_en_charge IN ('AFFECTEE', 'EN_COURS')), FALSE),
        COALESCE(BOOL_OR(contenu.etat_prise_en_charge = 'A_VERIFIER'), FALSE)
    INTO v_nombre_volets, v_a_affecter, v_en_cours, v_a_verifier
    FROM contenu_dossier AS contenu
    WHERE contenu.id_dossier = p_id_dossier
      AND contenu.etat_contenu_dossier = 'INCLUSE';

    IF v_nombre_volets = 0 THEN
        v_statut_calcule := 'A_QUALIFIER';
    ELSIF v_a_affecter THEN
        v_statut_calcule := 'EN_ATTENTE_AFFECTATION';
    ELSIF v_en_cours THEN
        v_statut_calcule := 'EN_COURS_DE_TRAITEMENT';
    ELSIF v_a_verifier OR v_nombre_volets > 0 THEN
        v_statut_calcule := 'EN_ATTENTE_VERIFICATION';
    ELSE
        RAISE EXCEPTION 'Impossible de calculer le statut du dossier %', p_id_dossier;
    END IF;

    UPDATE dossier_traitement
    SET statut_dossier = v_statut_calcule
    WHERE id_dossier = p_id_dossier;

    RETURN v_statut_calcule;
END;
$$;

SELECT recalculer_statut_dossier(id_dossier)
FROM dossier_traitement
WHERE statut_dossier NOT IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE');
