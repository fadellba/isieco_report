-- ============================================================================
-- ISI-Eco Report — Schéma Relationnel Complet (PostgreSQL 17.10 DBngin)
-- Version : 2.0.0 (Alignée sur MLD v2.13, Diagramme Classes v2.20 & ADR-07)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Nettoyage préventif si réinitialisation
DROP TABLE IF EXISTS notification CASCADE;
DROP TABLE IF EXISTS historique_points CASCADE;
DROP TABLE IF EXISTS evenement_metier CASCADE;
DROP TABLE IF EXISTS verification_resolution CASCADE;
DROP TABLE IF EXISTS photo_intervention CASCADE;
DROP TABLE IF EXISTS intervention CASCADE;
DROP TABLE IF EXISTS affectation CASCADE;
DROP TABLE IF EXISTS contenu_dossier CASCADE;
DROP TABLE IF EXISTS rattachement_signalement CASCADE;
DROP TABLE IF EXISTS dossier_traitement CASCADE;
DROP TABLE IF EXISTS contenu_signalement CASCADE;
DROP TABLE IF EXISTS photo_signalement CASCADE;
DROP TABLE IF EXISTS signalement CASCADE;
DROP TABLE IF EXISTS competence_equipe CASCADE;
DROP TABLE IF EXISTS appartenance_equipe CASCADE;
DROP TABLE IF EXISTS equipe CASCADE;
DROP TABLE IF EXISTS type_dechet CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS utilisateur_role CASCADE;
DROP TABLE IF EXISTS utilisateur CASCADE;
DROP TABLE IF EXISTS role CASCADE;

-- ----------------------------------------------------------------------------
-- 1. Référentiel des Rôles
-- ----------------------------------------------------------------------------
CREATE TABLE role (
    id_role UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_role VARCHAR(50) NOT NULL UNIQUE,
    libelle_role VARCHAR(100) NOT NULL,
    description TEXT
);

-- ----------------------------------------------------------------------------
-- 2. Utilisateurs & Authentification
-- ----------------------------------------------------------------------------
CREATE TABLE utilisateur (
    id_utilisateur UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    date_inscription TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    etat_compte VARCHAR(20) NOT NULL DEFAULT 'ACTIF' CHECK (etat_compte IN ('ACTIF', 'INACTIF', 'SUSPENDU'))
);

-- ----------------------------------------------------------------------------
-- 3. Attribution des Rôles (Historisée)
-- ----------------------------------------------------------------------------
CREATE TABLE utilisateur_role (
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_role UUID NOT NULL REFERENCES role(id_role) ON DELETE RESTRICT,
    date_debut TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin TIMESTAMPTZ,
    attribue_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    motif TEXT,
    CONSTRAINT pk_utilisateur_role PRIMARY KEY (id_utilisateur, id_role, date_debut),
    CONSTRAINT ck_utilisateur_role_period CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ----------------------------------------------------------------------------
-- 4. Sessions Actives Dual-Client (Web Cookie / Mobile Bearer Token)
-- ----------------------------------------------------------------------------
CREATE TABLE session (
    id_session UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    client_type VARCHAR(20) NOT NULL CHECK (client_type IN ('WEB', 'MOBILE')),
    date_creation TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_expiration TIMESTAMPTZ NOT NULL,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address VARCHAR(50),
    user_agent TEXT
);

CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_session_user ON session(id_utilisateur);

-- ----------------------------------------------------------------------------
-- 5. Référentiel des Types de Déchets
-- ----------------------------------------------------------------------------
CREATE TABLE type_dechet (
    id_type_dechet UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_type VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL,
    description TEXT,
    orientation_specialisee BOOLEAN NOT NULL DEFAULT FALSE,
    date_debut_validite TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin_validite TIMESTAMPTZ,
    CONSTRAINT ck_type_dechet_period CHECK (date_fin_validite IS NULL OR date_fin_validite >= date_debut_validite)
);

-- ----------------------------------------------------------------------------
-- 6. Équipes Opérationnelles
-- ----------------------------------------------------------------------------
CREATE TABLE equipe (
    id_equipe UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_equipe VARCHAR(150) NOT NULL,
    description TEXT,
    etat_equipe VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (etat_equipe IN ('ACTIVE', 'INACTIVE', 'DISSOUTE'))
);

-- ----------------------------------------------------------------------------
-- 7. Appartenance des Agents aux Équipes
-- ----------------------------------------------------------------------------
CREATE TABLE appartenance_equipe (
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_equipe UUID NOT NULL REFERENCES equipe(id_equipe) ON DELETE CASCADE,
    date_debut TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin TIMESTAMPTZ,
    fonction VARCHAR(100) NOT NULL DEFAULT 'AGENT_TERRAIN',
    CONSTRAINT pk_appartenance_equipe PRIMARY KEY (id_utilisateur, id_equipe, date_debut),
    CONSTRAINT ck_appartenance_equipe_period CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ----------------------------------------------------------------------------
-- 8. Compétences des Équipes par Type de Déchet
-- ----------------------------------------------------------------------------
CREATE TABLE competence_equipe (
    id_competence_equipe UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_equipe UUID NOT NULL REFERENCES equipe(id_equipe) ON DELETE CASCADE,
    id_type_dechet UUID NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    date_debut TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin TIMESTAMPTZ,
    commentaire TEXT,
    validee_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    CONSTRAINT uq_competence_equipe_triplet UNIQUE (id_equipe, id_type_dechet, date_debut),
    CONSTRAINT uq_competence_equipe_composition UNIQUE (id_competence_equipe, id_equipe, id_type_dechet),
    CONSTRAINT ck_competence_equipe_period CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- ----------------------------------------------------------------------------
-- 9. Observations Citoyennes (Signalements)
-- ----------------------------------------------------------------------------
CREATE TABLE signalement (
    id_signalement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_constat TIMESTAMPTZ,
    date_soumission TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    precision_localisation NUMERIC(8, 2),
    description_localisation TEXT,
    statut_signalement VARCHAR(35) NOT NULL DEFAULT 'SOUMIS' 
        CHECK (statut_signalement IN ('SOUMIS', 'EN_COURS_DE_QUALIFICATION', 'ACCEPTE_POUR_RATTACHEMENT', 'RATTACHE', 'REJETE')),
    decision_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    date_decision TIMESTAMPTZ,
    motif_decision TEXT,
    CONSTRAINT ck_signalement_localisation CHECK (
        (latitude IS NOT NULL AND longitude IS NOT NULL) OR 
        (description_localisation IS NOT NULL AND LENGTH(TRIM(description_localisation)) > 0)
    )
);

CREATE INDEX idx_signalement_user ON signalement(id_utilisateur);
CREATE INDEX idx_signalement_statut ON signalement(statut_signalement);

-- ----------------------------------------------------------------------------
-- 10. Photos Associées aux Signalements
-- ----------------------------------------------------------------------------
CREATE TABLE photo_signalement (
    id_photo_signalement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE CASCADE,
    reference_photo VARCHAR(255) NOT NULL,
    description TEXT,
    date_ajout TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 11. Contenu Déclaratif du Signalement (Multi-Catégories Initiales)
-- ----------------------------------------------------------------------------
CREATE TABLE contenu_signalement (
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE CASCADE,
    id_type_dechet UUID NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    quantite_estimee VARCHAR(50),
    volume_estime VARCHAR(50),
    remarque TEXT,
    CONSTRAINT pk_contenu_signalement PRIMARY KEY (id_signalement, id_type_dechet)
);

-- ----------------------------------------------------------------------------
-- 12. Dossiers Opérationnels de Traitement
-- ----------------------------------------------------------------------------
CREATE TABLE dossier_traitement (
    id_dossier UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_dossier VARCHAR(50) NOT NULL UNIQUE,
    description_synthese TEXT NOT NULL,
    date_creation_dossier TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    statut_dossier VARCHAR(35) NOT NULL DEFAULT 'A_QUALIFIER'
        CHECK (statut_dossier IN ('A_QUALIFIER', 'EN_ATTENTE_AFFECTATION', 'EN_COURS_DE_TRAITEMENT', 'EN_ATTENTE_VERIFICATION', 'CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE')),
    priorite VARCHAR(20) NOT NULL DEFAULT 'MOYENNE'
        CHECK (priorite IN ('FAIBLE', 'MOYENNE', 'ELEVEE', 'URGENTE')),
    date_qualification TIMESTAMPTZ,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    precision_localisation NUMERIC(8, 2),
    description_localisation TEXT,
    date_cloture TIMESTAMPTZ,
    cree_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT
);

CREATE INDEX idx_dossier_statut ON dossier_traitement(statut_dossier);

-- ----------------------------------------------------------------------------
-- 13. Rattachements Historisés Signalement <-> Dossier
-- ----------------------------------------------------------------------------
CREATE TABLE rattachement_signalement (
    id_rattachement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    id_dossier UUID NOT NULL REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    date_debut_rattachement TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin_rattachement TIMESTAMPTZ,
    type_rattachement VARCHAR(30) NOT NULL DEFAULT 'PRINCIPAL'
        CHECK (type_rattachement IN ('PRINCIPAL', 'CONFIRMATION', 'COMPLEMENT')),
    motif TEXT,
    id_acteur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    CONSTRAINT ck_rattachement_period CHECK (date_fin_rattachement IS NULL OR date_fin_rattachement >= date_debut_rattachement)
);

-- Un seul rattachement actif par signalement
CREATE UNIQUE INDEX uq_rattachement_actif ON rattachement_signalement(id_signalement) 
WHERE date_fin_rattachement IS NULL;

-- ----------------------------------------------------------------------------
-- 14. Contenu Qualifié du Dossier (Volets Techniques par Catégorie de Déchet)
-- ----------------------------------------------------------------------------
CREATE TABLE contenu_dossier (
    id_dossier UUID NOT NULL REFERENCES dossier_traitement(id_dossier) ON DELETE CASCADE,
    id_type_dechet UUID NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    quantite_estimee VARCHAR(50),
    volume_estime VARCHAR(50),
    niveau_risqu_qualifie VARCHAR(20) DEFAULT 'MOYEN'
        CHECK (niveau_risqu_qualifie IN ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE')),
    remarque TEXT,
    qualifie_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    date_qualification TIMESTAMPTZ,
    etat_contenu_dossier VARCHAR(20) NOT NULL DEFAULT 'INCLUSE'
        CHECK (etat_contenu_dossier IN ('INCLUSE', 'RETIRE')),
    date_retrait TIMESTAMPTZ,
    retire_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    motif_retrait TEXT,
    CONSTRAINT pk_contenu_dossier PRIMARY KEY (id_dossier, id_type_dechet),
    CONSTRAINT ck_contenu_dossier_retrait CHECK (
        (etat_contenu_dossier = 'INCLUSE' AND date_retrait IS NULL AND retire_par IS NULL AND motif_retrait IS NULL) OR
        (etat_contenu_dossier = 'RETIRE' AND date_retrait IS NOT NULL AND retire_par IS NOT NULL AND motif_retrait IS NOT NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 15. Affectations Spécialisées par Volet
-- ----------------------------------------------------------------------------
CREATE TABLE affectation (
    id_affectation UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_dossier UUID NOT NULL,
    id_type_dechet UUID NOT NULL,
    id_equipe UUID NOT NULL REFERENCES equipe(id_equipe) ON DELETE RESTRICT,
    id_competence_equipe UUID NOT NULL,
    date_heure_affectation TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_decideur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    etat_affectation VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (etat_affectation IN ('ACTIVE', 'A_VERIFIER', 'TERMINEE', 'REMPLACEE', 'ANNULEE')),
    motif TEXT,
    observation TEXT,
    date_fin_affectation TIMESTAMPTZ,
    reference_operation_unique VARCHAR(100) UNIQUE,
    -- Double clé étrangère composée essentielle pour l'intégrité relationnelle
    CONSTRAINT fk_affectation_contenu_dossier FOREIGN KEY (id_dossier, id_type_dechet)
        REFERENCES contenu_dossier(id_dossier, id_type_dechet) ON DELETE RESTRICT,
    CONSTRAINT fk_affectation_competence_equipe FOREIGN KEY (id_competence_equipe, id_equipe, id_type_dechet)
        REFERENCES competence_equipe(id_competence_equipe, id_equipe, id_type_dechet) ON DELETE RESTRICT,
    CONSTRAINT ck_affectation_period CHECK (date_fin_affectation IS NULL OR date_fin_affectation >= date_heure_affectation)
);

-- Règle vitale MLD §3.7 : Exactement une affectation courante (active ou à vérifier) par volet
CREATE UNIQUE INDEX uq_affectation_courante_par_volet ON affectation(id_dossier, id_type_dechet)
WHERE date_fin_affectation IS NULL;

-- ----------------------------------------------------------------------------
-- 16. Interventions Terrain
-- ----------------------------------------------------------------------------
CREATE TABLE intervention (
    id_intervention UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_affectation UUID NOT NULL REFERENCES affectation(id_affectation) ON DELETE RESTRICT,
    date_heure_debut TIMESTAMPTZ,
    date_heure_fin TIMESTAMPTZ,
    statut_intervention VARCHAR(25) NOT NULL DEFAULT 'PROGRAMMEE'
        CHECK (statut_intervention IN ('PROGRAMMEE', 'EN_COURS', 'TERMINEE', 'SUSPENDUE', 'ANNULEE')),
    resultat_intervention VARCHAR(25)
        CHECK (resultat_intervention IN ('SUCCES_TOTAL', 'SUCCES_PARTIEL', 'ECHEC', 'IMPOSSIBLE')),
    compte_rendu TEXT,
    motif_exception TEXT,
    renseigne_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    CONSTRAINT ck_intervention_fin CHECK (
        (statut_intervention != 'TERMINEE') OR 
        (date_heure_fin IS NOT NULL AND resultat_intervention IS NOT NULL AND compte_rendu IS NOT NULL AND LENGTH(TRIM(compte_rendu)) >= 10)
    ),
    CONSTRAINT ck_intervention_period CHECK (date_heure_fin IS NULL OR date_heure_debut IS NULL OR date_heure_fin >= date_heure_debut)
);

-- ----------------------------------------------------------------------------
-- 17. Photos d'Intervention
-- ----------------------------------------------------------------------------
CREATE TABLE photo_intervention (
    id_photo_intervention UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_intervention UUID NOT NULL REFERENCES intervention(id_intervention) ON DELETE CASCADE,
    reference_photo VARCHAR(255) NOT NULL,
    contexte_photo VARCHAR(30) NOT NULL DEFAULT 'FIN_INTERVENTION'
        CHECK (contexte_photo IN ('CONSTAT_INITIAL', 'DEBUT_INTERVENTION', 'FIN_INTERVENTION', 'VERIFICATION')),
    description TEXT,
    date_ajout TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 18. Vérification de Résolution par Volet
-- ----------------------------------------------------------------------------
CREATE TABLE verification_resolution (
    id_verification UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_affectation UUID NOT NULL REFERENCES affectation(id_affectation) ON DELETE RESTRICT,
    id_verificateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_verification TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resultat_verification VARCHAR(30) NOT NULL
        CHECK (resultat_verification IN ('CONFORME_RESOLU', 'PARTIEL_NON_RESOLU', 'NON_CONFORME')),
    etat_verification VARCHAR(20) NOT NULL DEFAULT 'COURANTE'
        CHECK (etat_verification IN ('COURANTE', 'REMPLACEE', 'ANNULEE')),
    motif TEXT,
    reference_preuve VARCHAR(255)
);

-- Une seule vérification courante par affectation
CREATE UNIQUE INDEX uq_verification_courante ON verification_resolution(id_affectation)
WHERE etat_verification = 'COURANTE';

-- ----------------------------------------------------------------------------
-- 19. Journal d'Audit Métier Immuable (EVENEMENT_METIER)
-- ----------------------------------------------------------------------------
CREATE TABLE evenement_metier (
    id_evenement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_evenement VARCHAR(50) NOT NULL,
    date_evenement TIMESTAMPTZ,
    date_enregistrement TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origine VARCHAR(30) NOT NULL DEFAULT 'PORTAIL_GESTION'
        CHECK (origine IN ('INTERFACE_CITOYEN', 'PORTAIL_GESTION', 'APPLICATION_TERRAIN', 'TRAITEMENT_AUTOMATIQUE')),
    id_acteur UUID REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    
    -- Cibles Simples
    id_signalement_cible UUID REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    id_dossier_cible UUID REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    id_rattachement_cible UUID REFERENCES rattachement_signalement(id_rattachement) ON DELETE RESTRICT,
    id_affectation_cible UUID REFERENCES affectation(id_affectation) ON DELETE RESTRICT,
    id_intervention_cible UUID REFERENCES intervention(id_intervention) ON DELETE RESTRICT,
    id_verification_cible UUID REFERENCES verification_resolution(id_verification) ON DELETE RESTRICT,
    id_utilisateur_cible UUID REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    id_equipe_cible UUID REFERENCES equipe(id_equipe) ON DELETE RESTRICT,
    id_type_dechet_cible UUID REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    id_competence_equipe_cible UUID REFERENCES competence_equipe(id_competence_equipe) ON DELETE RESTRICT,
    
    -- Cible Composite CONTENU_DOSSIER
    id_dossier_contenu_cible UUID,
    id_type_dechet_contenu_cible UUID,
    
    id_evenement_corrige UUID REFERENCES evenement_metier(id_evenement) ON DELETE RESTRICT,
    donnees_avant JSONB,
    donnees_apres JSONB,
    destinataire_externe VARCHAR(255),
    motif TEXT,
    correlation_id VARCHAR(100),
    reference_operation_unique VARCHAR(100) UNIQUE,
    version_schema VARCHAR(10) NOT NULL DEFAULT '2.13',
    
    -- Clé étrangère composite vers CONTENU_DOSSIER
    CONSTRAINT fk_evenement_contenu_dossier FOREIGN KEY (id_dossier_contenu_cible, id_type_dechet_contenu_cible)
        REFERENCES contenu_dossier(id_dossier, id_type_dechet) ON DELETE RESTRICT,
        
    -- Règle MLD §3.12 / T17 / T32 / T33 : Exactement un groupe cible non nul !
    CONSTRAINT ck_evenement_composite_pair CHECK (
        (id_dossier_contenu_cible IS NULL) = (id_type_dechet_contenu_cible IS NULL)
    ),
    CONSTRAINT ck_evenement_exclusive_target CHECK (
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

CREATE INDEX idx_evenement_date ON evenement_metier(date_enregistrement);
CREATE INDEX idx_evenement_acteur ON evenement_metier(id_acteur);
CREATE INDEX idx_evenement_type ON evenement_metier(type_evenement);

-- ----------------------------------------------------------------------------
-- 20. Valorisation Citoyenne (Points)
-- ----------------------------------------------------------------------------
CREATE TABLE historique_points (
    id_point UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_signalement UUID REFERENCES signalement(id_signalement) ON DELETE SET NULL,
    points INT NOT NULL CHECK (points > 0),
    date_attribution TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motif VARCHAR(255) NOT NULL
);

CREATE INDEX idx_points_user ON historique_points(id_utilisateur);

-- ----------------------------------------------------------------------------
-- 21. Notifications Internes
-- ----------------------------------------------------------------------------
CREATE TABLE notification (
    id_notification UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    titre VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    lu BOOLEAN NOT NULL DEFAULT FALSE,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lien_cible VARCHAR(255)
);

CREATE INDEX idx_notification_user ON notification(id_utilisateur);

