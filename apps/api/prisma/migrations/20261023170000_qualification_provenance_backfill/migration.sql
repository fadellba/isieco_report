INSERT INTO qualification_signalement (
    id_signalement,
    id_type_dechet,
    qualifie_par,
    date_qualification
)
SELECT
    s.id_signalement,
    cs.id_type_dechet,
    s.decision_par,
    COALESCE(s.date_decision, CURRENT_TIMESTAMP)
FROM signalement s
JOIN contenu_signalement cs ON cs.id_signalement = s.id_signalement
WHERE s.statut_signalement IN ('ACCEPTE_POUR_RATTACHEMENT', 'RATTACHE')
  AND s.decision_par IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM qualification_signalement q
      WHERE q.id_signalement = s.id_signalement
        AND q.id_type_dechet = cs.id_type_dechet
        AND q.etat_qualification = 'ACTIVE'
  )
ON CONFLICT DO NOTHING;

INSERT INTO provenance_contenu_dossier (
    id_dossier,
    id_type_dechet,
    id_signalement,
    id_rattachement,
    id_qualification,
    ajoute_par,
    date_debut,
    motif
)
SELECT
    r.id_dossier,
    q.id_type_dechet,
    r.id_signalement,
    r.id_rattachement,
    q.id_qualification,
    r.id_acteur,
    r.date_debut_rattachement,
    COALESCE(r.motif, 'Provenance rétablie lors de la migration')
FROM rattachement_signalement r
JOIN signalement s ON s.id_signalement = r.id_signalement
JOIN qualification_signalement q
  ON q.id_signalement = r.id_signalement
 AND q.etat_qualification = 'ACTIVE'
JOIN contenu_dossier c
  ON c.id_dossier = r.id_dossier
 AND c.id_type_dechet = q.id_type_dechet
 AND c.etat_contenu_dossier = 'INCLUSE'
WHERE r.date_fin_rattachement IS NULL
  AND s.statut_signalement = 'RATTACHE'
  AND NOT EXISTS (
      SELECT 1
      FROM provenance_contenu_dossier p
      WHERE p.id_rattachement = r.id_rattachement
        AND p.id_qualification = q.id_qualification
        AND p.date_fin IS NULL
  );
