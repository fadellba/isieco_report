ALTER TABLE signalement
    DROP CONSTRAINT IF EXISTS signalement_statut_signalement_check;

ALTER TABLE signalement
    ADD CONSTRAINT signalement_statut_signalement_check
    CHECK (statut_signalement IN (
        'BROUILLON',
        'SOUMIS',
        'EN_COURS_DE_QUALIFICATION',
        'A_COMPLETER',
        'ACCEPTE_POUR_RATTACHEMENT',
        'RATTACHE',
        'REJETE'
    ));

CREATE TABLE demande_complement (
    id_demande UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    demande_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_demande TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motif TEXT NOT NULL CHECK (length(btrim(motif)) >= 10),
    etat_demande VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
        CHECK (etat_demande IN ('EN_ATTENTE', 'REPONDUE'))
);

CREATE UNIQUE INDEX uq_demande_complement_active
    ON demande_complement(id_signalement)
    WHERE etat_demande = 'EN_ATTENTE';
CREATE INDEX idx_demande_complement_signalement
    ON demande_complement(id_signalement, date_demande);

CREATE TABLE reponse_complement (
    id_reponse UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_demande UUID NOT NULL UNIQUE REFERENCES demande_complement(id_demande) ON DELETE RESTRICT,
    repondu_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_reponse TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contenu TEXT NOT NULL CHECK (length(btrim(contenu)) BETWEEN 1 AND 5000)
);
