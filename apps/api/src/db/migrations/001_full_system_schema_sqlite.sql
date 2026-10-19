-- ============================================================================
-- ISI-Eco Report — Schéma Relationnel Complet (Version SQLite 3 Test Sync)
-- Version : 2.0.0 (Miroir exact de 001_full_system_schema.sql)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. Référentiel des Rôles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role (
    id_role TEXT PRIMARY KEY,
    code_role TEXT NOT NULL UNIQUE,
    libelle_role TEXT NOT NULL,
    description TEXT
);

-- ----------------------------------------------------------------------------
-- 2. Utilisateurs & Authentification
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateur (
    id_utilisateur TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    prenom TEXT,
    email TEXT NOT NULL UNIQUE,
    telephone TEXT,
    mot_de_passe_hash TEXT NOT NULL,
    date_inscription TEXT NOT NULL,
    etat_compte TEXT NOT NULL DEFAULT 'ACTIF' CHECK (etat_compte IN ('ACTIF', 'INACTIF', 'SUSPENDU'))
);

-- ----------------------------------------------------------------------------
-- 3. Attribution des Rôles (Historisée)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateur_role (
    id_utilisateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_role TEXT NOT NULL REFERENCES role(id_role) ON DELETE RESTRICT,
    date_debut TEXT NOT NULL,
    date_fin TEXT,
    attribue_par TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    motif TEXT,
    PRIMARY KEY (id_utilisateur, id_role, date_debut),
    CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ----------------------------------------------------------------------------
-- 4. Sessions Actives Dual-Client
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session (
    id_session TEXT PRIMARY KEY,
    id_utilisateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    client_type TEXT NOT NULL CHECK (client_type IN ('WEB', 'MOBILE')),
    date_creation TEXT NOT NULL,
    date_expiration TEXT NOT NULL,
    est_actif INTEGER NOT NULL DEFAULT 1,
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(id_utilisateur);

-- ----------------------------------------------------------------------------
-- 5. Référentiel des Types de Déchets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS type_dechet (
    id_type_dechet TEXT PRIMARY KEY,
    code_type TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    description TEXT,
    orientation_specialisee INTEGER NOT NULL DEFAULT 0,
    date_debut_validite TEXT NOT NULL,
    date_fin_validite TEXT,
    CHECK (date_fin_validite IS NULL OR date_fin_validite >= date_debut_validite)
);

-- ----------------------------------------------------------------------------
-- 6. Équipes Opérationnelles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipe (
    id_equipe TEXT PRIMARY KEY,
    nom_equipe TEXT NOT NULL,
    description TEXT,
    etat_equipe TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (etat_equipe IN ('ACTIVE', 'INACTIVE', 'DISSOUTE'))
);

-- ----------------------------------------------------------------------------
-- 7. Appartenance des Agents aux Équipes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appartenance_equipe (
    id_utilisateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_equipe TEXT NOT NULL REFERENCES equipe(id_equipe) ON DELETE CASCADE,
    date_debut TEXT NOT NULL,
    date_fin TEXT,
    fonction TEXT NOT NULL DEFAULT 'AGENT_TERRAIN',
    PRIMARY KEY (id_utilisateur, id_equipe, date_debut),
    CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ----------------------------------------------------------------------------
-- 8. Compétences des Équipes par Type de Déchet
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competence_equipe (
    id_competence_equipe TEXT PRIMARY KEY,
    id_equipe TEXT NOT NULL REFERENCES equipe(id_equipe) ON DELETE CASCADE,
    id_type_dechet TEXT NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    date_debut TEXT NOT NULL,
    date_fin TEXT,
    commentaire TEXT,
    validee_par TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    UNIQUE (id_equipe, id_type_dechet, date_debut),
    UNIQUE (id_competence_equipe, id_equipe, id_type_dechet),
    CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ----------------------------------------------------------------------------
-- 9. Observations Citoyennes (Signalements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signalement (
    id_signalement TEXT PRIMARY KEY,
    id_utilisateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_constat TEXT,
    date_soumission TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    precision_localisation REAL,
    description_localisation TEXT,
    statut_signalement TEXT NOT NULL DEFAULT 'SOUMIS' 
        CHECK (statut_signalement IN ('SOUMIS', 'EN_COURS_DE_QUALIFICATION', 'ACCEPTE_POUR_RATTACHEMENT', 'RATTACHE', 'REJETE')),
    decision_par TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    date_decision TEXT,
    motif_decision TEXT,
    CHECK (
        (latitude IS NOT NULL AND longitude IS NOT NULL) OR 
        (description_localisation IS NOT NULL AND LENGTH(TRIM(description_localisation)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_signalement_user ON signalement(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_signalement_statut ON signalement(statut_signalement);

-- ----------------------------------------------------------------------------
-- 10. Photos Associées aux Signalements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photo_signalement (
    id_photo_signalement TEXT PRIMARY KEY,
    id_signalement TEXT NOT NULL REFERENCES signalement(id_signalement) ON DELETE CASCADE,
    reference_photo TEXT NOT NULL,
    description TEXT,
    date_ajout TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 11. Contenu Déclaratif du Signalement
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contenu_signalement (
    id_signalement TEXT NOT NULL REFERENCES signalement(id_signalement) ON DELETE CASCADE,
    id_type_dechet TEXT NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    quantite_estimee TEXT,
    volume_estime TEXT,
    remarque TEXT,
    PRIMARY KEY (id_signalement, id_type_dechet)
);

-- ----------------------------------------------------------------------------
-- 12. Dossiers Opérationnels de Traitement
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dossier_traitement (
    id_dossier TEXT PRIMARY KEY,
    reference_dossier TEXT NOT NULL UNIQUE,
    description_synthese TEXT NOT NULL,
    date_creation_dossier TEXT NOT NULL,
    statut_dossier TEXT NOT NULL DEFAULT 'A_QUALIFIER'
        CHECK (statut_dossier IN ('A_QUALIFIER', 'EN_ATTENTE_AFFECTATION', 'EN_COURS_DE_TRAITEMENT', 'EN_ATTENTE_VERIFICATION', 'CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE')),
    priorite TEXT NOT NULL DEFAULT 'MOYENNE'
        CHECK (priorite IN ('FAIBLE', 'MOYENNE', 'ELEVEE', 'URGENTE')),
    date_qualification TEXT,
    latitude REAL,
    longitude REAL,
    precision_localisation REAL,
    description_localisation TEXT,
    date_cloture TEXT,
    cree_par TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dossier_statut ON dossier_traitement(statut_dossier);

-- ----------------------------------------------------------------------------
-- 13. Rattachements Historisés Signalement <-> Dossier
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rattachement_signalement (
    id_rattachement TEXT PRIMARY KEY,
    id_signalement TEXT NOT NULL REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    id_dossier TEXT NOT NULL REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    date_debut_rattachement TEXT NOT NULL,
    date_fin_rattachement TEXT,
    type_rattachement TEXT NOT NULL DEFAULT 'PRINCIPAL'
        CHECK (type_rattachement IN ('PRINCIPAL', 'CONFIRMATION', 'COMPLEMENT')),
    motif TEXT,
    id_acteur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    CHECK (date_fin_rattachement IS NULL OR date_fin_rattachement >= date_debut_rattachement)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rattachement_actif ON rattachement_signalement(id_signalement) 
WHERE date_fin_rattachement IS NULL;

-- ----------------------------------------------------------------------------
-- 14. Contenu Qualifié du Dossier
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contenu_dossier (
    id_dossier TEXT NOT NULL REFERENCES dossier_traitement(id_dossier) ON DELETE CASCADE,
    id_type_dechet TEXT NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    quantite_estimee TEXT,
    volume_estime TEXT,
    niveau_risqu_qualifie TEXT DEFAULT 'MOYEN'
        CHECK (niveau_risqu_qualifie IN ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE')),
    remarque TEXT,
    qualifie_par TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    date_qualification TEXT,
    etat_contenu_dossier TEXT NOT NULL DEFAULT 'INCLUSE'
        CHECK (etat_contenu_dossier IN ('INCLUSE', 'RETIRE')),
    date_retrait TEXT,
    retire_par TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    motif_retrait TEXT,
    PRIMARY KEY (id_dossier, id_type_dechet),
    CHECK (
        (etat_contenu_dossier = 'INCLUSE' AND date_retrait IS NULL AND retire_par IS NULL AND motif_retrait IS NULL) OR
        (etat_contenu_dossier = 'RETIRE' AND date_retrait IS NOT NULL AND retire_par IS NOT NULL AND motif_retrait IS NOT NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 15. Affectations Spécialisées par Volet
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affectation (
    id_affectation TEXT PRIMARY KEY,
    id_dossier TEXT NOT NULL,
    id_type_dechet TEXT NOT NULL,
    id_equipe TEXT NOT NULL REFERENCES equipe(id_equipe) ON DELETE RESTRICT,
    id_competence_equipe TEXT NOT NULL,
    date_heure_affectation TEXT NOT NULL,
    id_decideur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    etat_affectation TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (etat_affectation IN ('ACTIVE', 'A_VERIFIER', 'TERMINEE', 'REMPLACEE', 'ANNULEE')),
    motif TEXT,
    observation TEXT,
    date_fin_affectation TEXT,
    reference_operation_unique TEXT UNIQUE,
    FOREIGN KEY (id_dossier, id_type_dechet)
        REFERENCES contenu_dossier(id_dossier, id_type_dechet) ON DELETE RESTRICT,
    FOREIGN KEY (id_competence_equipe, id_equipe, id_type_dechet)
        REFERENCES competence_equipe(id_competence_equipe, id_equipe, id_type_dechet) ON DELETE RESTRICT,
    CHECK (date_fin_affectation IS NULL OR date_fin_affectation >= date_heure_affectation)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_affectation_courante_par_volet ON affectation(id_dossier, id_type_dechet)
WHERE date_fin_affectation IS NULL;

-- ----------------------------------------------------------------------------
-- 16. Interventions Terrain
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intervention (
    id_intervention TEXT PRIMARY KEY,
    id_affectation TEXT NOT NULL REFERENCES affectation(id_affectation) ON DELETE RESTRICT,
    date_heure_debut TEXT,
    date_heure_fin TEXT,
    statut_intervention TEXT NOT NULL DEFAULT 'PROGRAMMEE'
        CHECK (statut_intervention IN ('PROGRAMMEE', 'EN_COURS', 'TERMINEE', 'SUSPENDUE', 'ANNULEE')),
    resultat_intervention TEXT
        CHECK (resultat_intervention IN ('SUCCES_TOTAL', 'SUCCES_PARTIEL', 'ECHEC', 'IMPOSSIBLE')),
    compte_rendu TEXT,
    motif_exception TEXT,
    renseigne_par TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    CHECK (
        (statut_intervention != 'TERMINEE') OR 
        (date_heure_fin IS NOT NULL AND resultat_intervention IS NOT NULL AND compte_rendu IS NOT NULL AND LENGTH(TRIM(compte_rendu)) >= 10)
    ),
    CHECK (date_heure_fin IS NULL OR date_heure_debut IS NULL OR date_heure_fin >= date_heure_debut)
);

-- ----------------------------------------------------------------------------
-- 17. Photos d'Intervention
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photo_intervention (
    id_photo_intervention TEXT PRIMARY KEY,
    id_intervention TEXT NOT NULL REFERENCES intervention(id_intervention) ON DELETE CASCADE,
    reference_photo TEXT NOT NULL,
    contexte_photo TEXT NOT NULL DEFAULT 'FIN_INTERVENTION'
        CHECK (contexte_photo IN ('CONSTAT_INITIAL', 'DEBUT_INTERVENTION', 'FIN_INTERVENTION', 'VERIFICATION')),
    description TEXT,
    date_ajout TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 18. Vérification de Résolution par Volet
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_resolution (
    id_verification TEXT PRIMARY KEY,
    id_affectation TEXT NOT NULL REFERENCES affectation(id_affectation) ON DELETE RESTRICT,
    id_verificateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_verification TEXT NOT NULL,
    resultat_verification TEXT NOT NULL
        CHECK (resultat_verification IN ('CONFORME_RESOLU', 'PARTIEL_NON_RESOLU', 'NON_CONFORME')),
    etat_verification TEXT NOT NULL DEFAULT 'COURANTE'
        CHECK (etat_verification IN ('COURANTE', 'REMPLACEE', 'ANNULEE')),
    motif TEXT,
    reference_preuve TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_courante ON verification_resolution(id_affectation)
WHERE etat_verification = 'COURANTE';

-- ----------------------------------------------------------------------------
-- 19. Journal d'Audit Métier Immuable
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evenement_metier (
    id_evenement TEXT PRIMARY KEY,
    type_evenement TEXT NOT NULL,
    date_evenement TEXT,
    date_enregistrement TEXT NOT NULL,
    origine TEXT NOT NULL DEFAULT 'PORTAIL_GESTION'
        CHECK (origine IN ('INTERFACE_CITOYEN', 'PORTAIL_GESTION', 'APPLICATION_TERRAIN', 'TRAITEMENT_AUTOMATIQUE')),
    id_acteur TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    
    id_signalement_cible TEXT REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    id_dossier_cible TEXT REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    id_rattachement_cible TEXT REFERENCES rattachement_signalement(id_rattachement) ON DELETE RESTRICT,
    id_affectation_cible TEXT REFERENCES affectation(id_affectation) ON DELETE RESTRICT,
    id_intervention_cible TEXT REFERENCES intervention(id_intervention) ON DELETE RESTRICT,
    id_verification_cible TEXT REFERENCES verification_resolution(id_verification) ON DELETE RESTRICT,
    id_utilisateur_cible TEXT REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    id_equipe_cible TEXT REFERENCES equipe(id_equipe) ON DELETE RESTRICT,
    id_type_dechet_cible TEXT REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    id_competence_equipe_cible TEXT REFERENCES competence_equipe(id_competence_equipe) ON DELETE RESTRICT,
    
    id_dossier_contenu_cible TEXT,
    id_type_dechet_contenu_cible TEXT,
    
    id_evenement_corrige TEXT REFERENCES evenement_metier(id_evenement) ON DELETE RESTRICT,
    donnees_avant TEXT,
    donnees_apres TEXT,
    destinataire_externe TEXT,
    motif TEXT,
    correlation_id TEXT,
    reference_operation_unique TEXT UNIQUE,
    version_schema TEXT NOT NULL DEFAULT '2.13',
    
    FOREIGN KEY (id_dossier_contenu_cible, id_type_dechet_contenu_cible)
        REFERENCES contenu_dossier(id_dossier, id_type_dechet) ON DELETE RESTRICT,
        
    CHECK ((id_dossier_contenu_cible IS NULL) = (id_type_dechet_contenu_cible IS NULL)),
    CHECK (
        (
            (CASE WHEN id_signalement_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_dossier_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_rattachement_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_affectation_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_intervention_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_verification_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_utilisateur_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_equipe_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_type_dechet_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_competence_equipe_cible IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN id_dossier_contenu_cible IS NOT NULL AND id_type_dechet_contenu_cible IS NOT NULL THEN 1 ELSE 0 END)
        ) = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_evenement_date ON evenement_metier(date_enregistrement);
CREATE INDEX IF NOT EXISTS idx_evenement_acteur ON evenement_metier(id_acteur);
CREATE INDEX IF NOT EXISTS idx_evenement_type ON evenement_metier(type_evenement);

-- ----------------------------------------------------------------------------
-- 20. Valorisation Citoyenne (Points)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historique_points (
    id_point TEXT PRIMARY KEY,
    id_utilisateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_signalement TEXT REFERENCES signalement(id_signalement) ON DELETE SET NULL,
    points INTEGER NOT NULL CHECK (points > 0),
    date_attribution TEXT NOT NULL,
    motif TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_user ON historique_points(id_utilisateur);

-- ----------------------------------------------------------------------------
-- 21. Notifications Internes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification (
    id_notification TEXT PRIMARY KEY,
    id_utilisateur TEXT NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    message TEXT NOT NULL,
    lu INTEGER NOT NULL DEFAULT 0,
    date_creation TEXT NOT NULL,
    lien_cible TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(id_utilisateur);

