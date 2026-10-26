CREATE OR REPLACE FUNCTION verifier_decision_equipe() RETURNS TRIGGER AS $$
DECLARE
    v_type_decision VARCHAR(40);
BEGIN
    IF TG_TABLE_NAME IN ('disponibilite_equipe', 'historique_disponibilite_equipe') THEN
        v_type_decision := 'MISE_A_JOUR_DISPONIBILITE';
        IF NOT EXISTS (
            SELECT 1 FROM appartenance_equipe a
             WHERE a.id_utilisateur = NEW.mise_a_jour_par
               AND a.id_equipe = NEW.id_equipe
               AND a.fonction IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
               AND a.date_debut <= NEW.date_mise_a_jour
               AND (a.date_fin IS NULL OR a.date_fin >= NEW.date_mise_a_jour)
        ) AND NOT EXISTS (
            SELECT 1 FROM delegation_decision_equipe d
             WHERE d.id_utilisateur_delegue = NEW.mise_a_jour_par
               AND d.id_equipe = NEW.id_equipe
               AND d.type_decision = v_type_decision
               AND EXISTS (
                    SELECT 1 FROM appartenance_equipe a
                     WHERE a.id_utilisateur = d.id_utilisateur_delegue
                       AND a.id_equipe = d.id_equipe
                       AND a.fonction NOT IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
                       AND a.date_debut <= NEW.date_mise_a_jour
                       AND (a.date_fin IS NULL OR a.date_fin >= NEW.date_mise_a_jour)
               )
               AND d.date_debut <= NEW.date_mise_a_jour
               AND (d.date_fin IS NULL OR d.date_fin >= NEW.date_mise_a_jour)
        ) THEN
            RAISE EXCEPTION 'La disponibilité est réservée au chef ou à un membre explicitement délégué';
        END IF;
    ELSIF NEW.decision_equipe <> 'EN_ATTENTE'
       AND (OLD.decision_equipe IS DISTINCT FROM NEW.decision_equipe
            OR OLD.repondu_par IS DISTINCT FROM NEW.repondu_par) THEN
        v_type_decision := 'REPONSE_AFFECTATION';
        IF NOT EXISTS (
            SELECT 1 FROM appartenance_equipe a
             WHERE a.id_utilisateur = NEW.repondu_par
               AND a.id_equipe = NEW.id_equipe
               AND a.fonction IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
               AND a.date_fin IS NULL
        ) AND NOT EXISTS (
            SELECT 1 FROM delegation_decision_equipe d
             WHERE d.id_utilisateur_delegue = NEW.repondu_par
               AND d.id_equipe = NEW.id_equipe
               AND d.type_decision = v_type_decision
               AND EXISTS (
                    SELECT 1 FROM appartenance_equipe a
                     WHERE a.id_utilisateur = d.id_utilisateur_delegue
                       AND a.id_equipe = d.id_equipe
                       AND a.fonction NOT IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
                       AND a.date_debut <= CURRENT_TIMESTAMP
                       AND (a.date_fin IS NULL OR a.date_fin >= CURRENT_TIMESTAMP)
               )
               AND d.date_debut <= CURRENT_TIMESTAMP
               AND (d.date_fin IS NULL OR d.date_fin >= CURRENT_TIMESTAMP)
        ) THEN
            RAISE EXCEPTION 'Seul le chef ou un membre explicitement délégué peut répondre à une affectation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
