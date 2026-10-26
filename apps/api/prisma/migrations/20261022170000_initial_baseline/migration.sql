-- ============================================================================
-- ISI-Eco Report — Schéma Relationnel Complet (PostgreSQL 17.10 DBngin)
-- Version : 3.0.0 (Schéma métier cible, Sénégal)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Initial Prisma baseline: create the schema without dropping existing objects.

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
    reference_avatar VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    date_inscription TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    etat_compte VARCHAR(20) NOT NULL DEFAULT 'ACTIF' CHECK (etat_compte IN ('ACTIF', 'INACTIF', 'SUSPENDU'))
);

CREATE TABLE preferences_visibilite_citoyen (
    id_utilisateur UUID PRIMARY KEY REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    afficher_avatar BOOLEAN NOT NULL DEFAULT FALSE,
    afficher_nom_public BOOLEAN NOT NULL DEFAULT FALSE,
    nom_public VARCHAR(100),
    afficher_points BOOLEAN NOT NULL DEFAULT FALSE,
    afficher_rang BOOLEAN NOT NULL DEFAULT FALSE,
    afficher_badges BOOLEAN NOT NULL DEFAULT FALSE,
    participer_classement BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_nom_public_visible CHECK (NOT afficher_nom_public OR nom_public IS NOT NULL)
);

CREATE TABLE badge (
    id_badge UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_badge VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL,
    description TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE badge_utilisateur (
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_badge UUID NOT NULL REFERENCES badge(id_badge) ON DELETE RESTRICT,
    date_attribution TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attribue_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    motif TEXT,
    PRIMARY KEY (id_utilisateur, id_badge)
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

-- Le quartier/village reste un repère textuel ; aucun référentiel officiel
-- de ce niveau n'a été arrêté pour cette version.
CREATE TABLE region (
    id_region UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_region VARCHAR(30) UNIQUE,
    nom_region VARCHAR(120) NOT NULL UNIQUE,
    actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE departement (
    id_departement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_region UUID NOT NULL REFERENCES region(id_region) ON DELETE RESTRICT,
    code_departement VARCHAR(30),
    nom_departement VARCHAR(120) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_departement_region_nom UNIQUE (id_region, nom_departement),
    CONSTRAINT uq_departement_region_code UNIQUE (id_region, code_departement),
    CONSTRAINT uq_departement_region_id UNIQUE (id_departement, id_region)
);

CREATE TABLE commune (
    id_commune UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_departement UUID NOT NULL REFERENCES departement(id_departement) ON DELETE RESTRICT,
    code_commune VARCHAR(30),
    nom_commune VARCHAR(120) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_commune_departement_nom UNIQUE (id_departement, nom_commune),
    CONSTRAINT uq_commune_departement_code UNIQUE (id_departement, code_commune),
    CONSTRAINT uq_commune_departement_id UNIQUE (id_commune, id_departement)
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

CREATE TABLE disponibilite_equipe (
    id_equipe UUID PRIMARY KEY REFERENCES equipe(id_equipe) ON DELETE CASCADE,
    etat_disponibilite VARCHAR(20) NOT NULL CHECK (etat_disponibilite IN ('DISPONIBLE', 'INDISPONIBLE')),
    mise_a_jour_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_mise_a_jour TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valide_jusqua TIMESTAMPTZ NOT NULL,
    commentaire TEXT,
    CONSTRAINT ck_disponibilite_expiration CHECK (valide_jusqua >= date_mise_a_jour)
);

CREATE VIEW disponibilite_equipe_courante AS
SELECT id_equipe,
       CASE WHEN CURRENT_TIMESTAMP <= valide_jusqua THEN etat_disponibilite ELSE 'INCONNUE' END AS etat_disponibilite,
       mise_a_jour_par,
       date_mise_a_jour,
       valide_jusqua,
       commentaire
  FROM disponibilite_equipe;

CREATE TABLE historique_disponibilite_equipe (
    id_historique UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_equipe UUID NOT NULL REFERENCES equipe(id_equipe) ON DELETE RESTRICT,
    etat_disponibilite VARCHAR(20) NOT NULL CHECK (etat_disponibilite IN ('DISPONIBLE', 'INDISPONIBLE')),
    mise_a_jour_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_mise_a_jour TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valide_jusqua TIMESTAMPTZ NOT NULL,
    commentaire TEXT,
    CONSTRAINT ck_historique_disponibilite_expiration CHECK (valide_jusqua >= date_mise_a_jour)
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
    CONSTRAINT ck_appartenance_equipe_period CHECK (date_fin IS NULL OR date_fin >= date_debut),
    CONSTRAINT ck_fonction_appartenance CHECK (fonction IN ('AGENT_TERRAIN', 'CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN'))
);

CREATE UNIQUE INDEX uq_chef_equipe_actif ON appartenance_equipe(id_equipe)
    WHERE fonction IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN') AND date_fin IS NULL;

CREATE TABLE delegation_decision_equipe (
    id_delegation UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_equipe UUID NOT NULL REFERENCES equipe(id_equipe) ON DELETE RESTRICT,
    id_utilisateur_delegue UUID NOT NULL,
    date_debut_appartenance TIMESTAMPTZ NOT NULL,
    type_decision VARCHAR(40) NOT NULL
        CHECK (type_decision IN ('REPONSE_AFFECTATION', 'MISE_A_JOUR_DISPONIBILITE', 'SOUMISSION_COMPTE_RENDU')),
    delegue_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_debut TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin TIMESTAMPTZ,
    motif TEXT,
    CONSTRAINT fk_delegation_membre FOREIGN KEY (id_utilisateur_delegue, id_equipe, date_debut_appartenance)
        REFERENCES appartenance_equipe(id_utilisateur, id_equipe, date_debut) ON DELETE RESTRICT,
    CONSTRAINT ck_delegation_period CHECK (date_fin IS NULL OR date_fin >= date_debut),
    CONSTRAINT uq_delegation_debut UNIQUE (id_equipe, id_utilisateur_delegue, type_decision, date_debut)
);

CREATE UNIQUE INDEX uq_delegation_active_responsabilite
    ON delegation_decision_equipe(id_equipe, type_decision)
    WHERE date_fin IS NULL;

CREATE OR REPLACE FUNCTION verifier_delegation_chef_equipe() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM appartenance_equipe a
         WHERE a.id_utilisateur = NEW.delegue_par
           AND a.id_equipe = NEW.id_equipe
           AND a.fonction IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
           AND a.date_debut <= NEW.date_debut
           AND (a.date_fin IS NULL OR a.date_fin >= NEW.date_debut)
    ) THEN
        RAISE EXCEPTION 'Seul le chef de cette équipe peut accorder une délégation';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM appartenance_equipe a
         WHERE a.id_utilisateur = NEW.id_utilisateur_delegue
           AND a.id_equipe = NEW.id_equipe
           AND a.date_debut = NEW.date_debut_appartenance
           AND a.fonction NOT IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
           AND a.date_fin IS NULL
    ) THEN
        RAISE EXCEPTION 'La délégation doit être accordée à un membre actif de l''équipe';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verifier_delegation_chef_equipe
    BEFORE INSERT OR UPDATE ON delegation_decision_equipe
    FOR EACH ROW EXECUTE FUNCTION verifier_delegation_chef_equipe();

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
               AND a.date_fin IS NULL
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
                       AND a.date_debut <= CURRENT_TIMESTAMP
                       AND (a.date_fin IS NULL OR a.date_fin >= CURRENT_TIMESTAMP)
               )
               AND d.date_debut <= CURRENT_TIMESTAMP
               AND (d.date_fin IS NULL OR d.date_fin >= CURRENT_TIMESTAMP)
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

CREATE TRIGGER trg_verifier_decision_disponibilite
    BEFORE INSERT OR UPDATE ON disponibilite_equipe
    FOR EACH ROW EXECUTE FUNCTION verifier_decision_equipe();

CREATE FUNCTION historiser_disponibilite_equipe() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historique_disponibilite_equipe (
        id_historique, id_equipe, etat_disponibilite, mise_a_jour_par,
        date_mise_a_jour, valide_jusqua, commentaire
    ) VALUES (
        gen_random_uuid(), OLD.id_equipe, OLD.etat_disponibilite, OLD.mise_a_jour_par,
        OLD.date_mise_a_jour, OLD.valide_jusqua, OLD.commentaire
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historiser_disponibilite_equipe
    AFTER UPDATE ON disponibilite_equipe
    FOR EACH ROW EXECUTE FUNCTION historiser_disponibilite_equipe();

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
    date_soumission TIMESTAMPTZ,
    description TEXT,
    id_commune UUID REFERENCES commune(id_commune) ON DELETE RESTRICT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    precision_localisation NUMERIC(8, 2),
    description_localisation TEXT,
    statut_signalement VARCHAR(35) NOT NULL DEFAULT 'BROUILLON'
        CHECK (statut_signalement IN ('BROUILLON', 'SOUMIS', 'EN_COURS_DE_QUALIFICATION', 'ACCEPTE_POUR_RATTACHEMENT', 'RATTACHE', 'REJETE')),
    decision_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    date_decision TIMESTAMPTZ,
    motif_decision TEXT,
    CONSTRAINT ck_signalement_coordonnees CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

CREATE INDEX idx_signalement_user ON signalement(id_utilisateur);
CREATE INDEX idx_signalement_statut ON signalement(statut_signalement);

-- Catégories déclarées par le citoyen; elles ne valent pas qualification métier.
CREATE TABLE contenu_signalement (
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE CASCADE,
    id_type_dechet UUID NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    quantite_estimee VARCHAR(50),
    volume_estime VARCHAR(50),
    remarque TEXT,
    CONSTRAINT pk_contenu_signalement PRIMARY KEY (id_signalement, id_type_dechet)
);

-- ----------------------------------------------------------------------------
-- 10. Photos Associées aux Signalements
-- ----------------------------------------------------------------------------
CREATE TABLE photo_signalement (
    id_photo_signalement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE CASCADE,
    reference_photo VARCHAR(255) NOT NULL,
    description TEXT,
    date_ajout TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    etat_publication VARCHAR(20) NOT NULL DEFAULT 'INTERNE'
        CHECK (etat_publication IN ('INTERNE', 'EN_ATTENTE', 'APPROUVEE', 'REFUSEE')),
    reference_photo_publique VARCHAR(255),
    floutage_confirme BOOLEAN NOT NULL DEFAULT FALSE,
    approuve_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_approbation TIMESTAMPTZ,
    CONSTRAINT ck_photo_signalement_publication CHECK (
        (etat_publication = 'APPROUVEE' AND reference_photo_publique IS NOT NULL
            AND floutage_confirme AND approuve_par IS NOT NULL AND date_approbation IS NOT NULL)
        OR (etat_publication <> 'APPROUVEE' AND approuve_par IS NULL AND date_approbation IS NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 11. Qualification administrative des signalements
-- ----------------------------------------------------------------------------
CREATE TABLE qualification_signalement (
    id_qualification UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_signalement UUID NOT NULL REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    id_type_dechet UUID NOT NULL REFERENCES type_dechet(id_type_dechet) ON DELETE RESTRICT,
    quantite_estimee VARCHAR(50),
    volume_estime VARCHAR(50),
    remarque TEXT,
    qualifie_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_qualification TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    etat_qualification VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (etat_qualification IN ('ACTIVE', 'RETIRE')),
    motif_retrait TEXT,
    CONSTRAINT uq_qualification_source UNIQUE (id_qualification, id_signalement, id_type_dechet),
    CONSTRAINT ck_qualification_retrait CHECK (
        (etat_qualification = 'ACTIVE' AND motif_retrait IS NULL)
        OR (etat_qualification = 'RETIRE' AND motif_retrait IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_qualification_active_signalement_type
    ON qualification_signalement(id_signalement, id_type_dechet)
    WHERE etat_qualification = 'ACTIVE';

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
    id_commune UUID REFERENCES commune(id_commune) ON DELETE RESTRICT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    precision_localisation NUMERIC(8, 2),
    description_localisation TEXT,
    date_cloture TIMESTAMPTZ,
    cree_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    CONSTRAINT ck_dossier_coordonnees CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

CREATE INDEX idx_dossier_statut ON dossier_traitement(statut_dossier);

CREATE TABLE historique_priorite_dossier (
    id_historique UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_dossier UUID NOT NULL REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    priorite VARCHAR(20) NOT NULL CHECK (priorite IN ('FAIBLE', 'MOYENNE', 'ELEVEE', 'URGENTE')),
    definie_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_definition TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    justification TEXT NOT NULL
);

CREATE TABLE historique_localisation_dossier (
    id_historique UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_dossier UUID NOT NULL REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    id_commune UUID REFERENCES commune(id_commune) ON DELETE RESTRICT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    precision_localisation NUMERIC(8, 2),
    description_localisation TEXT,
    modifie_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_modification TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motif TEXT,
    CONSTRAINT ck_historique_localisation_coordonnees CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

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
    CONSTRAINT ck_rattachement_period CHECK (date_fin_rattachement IS NULL OR date_fin_rattachement >= date_debut_rattachement),
    CONSTRAINT uq_rattachement_provenance UNIQUE (id_rattachement, id_dossier, id_signalement)
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
    etat_prise_en_charge VARCHAR(25) NOT NULL DEFAULT 'A_AFFECTER'
        CHECK (etat_prise_en_charge IN ('A_AFFECTER', 'EN_ATTENTE_EQUIPE', 'AFFECTEE', 'EN_COURS', 'A_VERIFIER', 'TERMINEE')),
    date_attente_equipe TIMESTAMPTZ,
    motif_attente_equipe TEXT,
    date_retrait TIMESTAMPTZ,
    retire_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
    motif_retrait TEXT,
    CONSTRAINT pk_contenu_dossier PRIMARY KEY (id_dossier, id_type_dechet),
    CONSTRAINT ck_contenu_dossier_retrait CHECK (
        (etat_contenu_dossier = 'INCLUSE' AND date_retrait IS NULL AND retire_par IS NULL AND motif_retrait IS NULL) OR
        (etat_contenu_dossier = 'RETIRE' AND date_retrait IS NOT NULL AND retire_par IS NOT NULL AND motif_retrait IS NOT NULL)
    ),
    CONSTRAINT ck_contenu_dossier_attente CHECK (
        (etat_prise_en_charge = 'EN_ATTENTE_EQUIPE' AND date_attente_equipe IS NOT NULL AND motif_attente_equipe IS NOT NULL)
        OR (etat_prise_en_charge <> 'EN_ATTENTE_EQUIPE' AND date_attente_equipe IS NULL AND motif_attente_equipe IS NULL)
    )
);

CREATE TABLE provenance_contenu_dossier (
    id_dossier UUID NOT NULL,
    id_type_dechet UUID NOT NULL,
    id_signalement UUID NOT NULL,
    id_rattachement UUID NOT NULL,
    id_qualification UUID NOT NULL,
    ajoute_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_debut TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fin TIMESTAMPTZ,
    motif TEXT,
    PRIMARY KEY (id_dossier, id_type_dechet, id_qualification, date_debut),
    CONSTRAINT fk_provenance_contenu_dossier FOREIGN KEY (id_dossier, id_type_dechet)
        REFERENCES contenu_dossier(id_dossier, id_type_dechet) ON DELETE RESTRICT,
    CONSTRAINT fk_provenance_qualification_source FOREIGN KEY (id_qualification, id_signalement, id_type_dechet)
        REFERENCES qualification_signalement(id_qualification, id_signalement, id_type_dechet) ON DELETE RESTRICT,
    CONSTRAINT fk_provenance_rattachement_source FOREIGN KEY (id_rattachement, id_dossier, id_signalement)
        REFERENCES rattachement_signalement(id_rattachement, id_dossier, id_signalement) ON DELETE RESTRICT,
    CONSTRAINT ck_provenance_period CHECK (date_fin IS NULL OR date_fin >= date_debut)
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
    decision_equipe VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
        CHECK (decision_equipe IN ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE')),
    repondu_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_reponse_equipe TIMESTAMPTZ,
    motif_refus_equipe TEXT,
    reference_operation_unique VARCHAR(100) UNIQUE,
    -- Double clé étrangère composée essentielle pour l'intégrité relationnelle
    CONSTRAINT fk_affectation_contenu_dossier FOREIGN KEY (id_dossier, id_type_dechet)
        REFERENCES contenu_dossier(id_dossier, id_type_dechet) ON DELETE RESTRICT,
    CONSTRAINT fk_affectation_competence_equipe FOREIGN KEY (id_competence_equipe, id_equipe, id_type_dechet)
        REFERENCES competence_equipe(id_competence_equipe, id_equipe, id_type_dechet) ON DELETE RESTRICT,
    CONSTRAINT ck_affectation_period CHECK (date_fin_affectation IS NULL OR date_fin_affectation >= date_heure_affectation),
    CONSTRAINT ck_affectation_reponse_equipe CHECK (
        (decision_equipe = 'EN_ATTENTE' AND repondu_par IS NULL AND date_reponse_equipe IS NULL AND motif_refus_equipe IS NULL)
        OR (decision_equipe = 'ACCEPTEE' AND repondu_par IS NOT NULL AND date_reponse_equipe IS NOT NULL AND motif_refus_equipe IS NULL)
        OR (decision_equipe = 'REFUSEE' AND repondu_par IS NOT NULL AND date_reponse_equipe IS NOT NULL
            AND motif_refus_equipe IS NOT NULL AND LENGTH(TRIM(motif_refus_equipe)) > 0)
    )
);

CREATE TRIGGER trg_verifier_reponse_affectation_equipe
    BEFORE INSERT OR UPDATE OF decision_equipe, repondu_par ON affectation
    FOR EACH ROW EXECUTE FUNCTION verifier_decision_equipe();

-- Point de contact unique exposé au back-office : l'équipe répond via son chef.
CREATE VIEW affectation_interlocuteur_chef AS
SELECT a.id_affectation,
       a.id_dossier,
       a.id_type_dechet,
       a.id_equipe,
       e.nom_equipe,
       c.id_utilisateur AS id_chef_equipe,
       u.nom AS nom_chef,
       u.prenom AS prenom_chef,
       a.etat_affectation,
       a.decision_equipe,
       a.date_heure_affectation
  FROM affectation a
  JOIN equipe e ON e.id_equipe = a.id_equipe
  JOIN appartenance_equipe c
    ON c.id_equipe = a.id_equipe
   AND c.fonction IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
   AND c.date_fin IS NULL
  JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur;

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
    date_soumission_compte_rendu TIMESTAMPTZ,
    statut_intervention VARCHAR(25) NOT NULL DEFAULT 'PROGRAMMEE'
        CHECK (statut_intervention IN ('PROGRAMMEE', 'EN_COURS', 'TERMINEE', 'SUSPENDUE', 'ANNULEE')),
    resultat_intervention VARCHAR(25)
        CHECK (resultat_intervention IN ('SUCCES_TOTAL', 'SUCCES_PARTIEL', 'ECHEC', 'IMPOSSIBLE')),
    compte_rendu TEXT,
    motif_exception TEXT,
    renseigne_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    CONSTRAINT ck_intervention_fin CHECK (
        (statut_intervention != 'TERMINEE') OR 
        (date_heure_fin IS NOT NULL AND resultat_intervention IS NOT NULL AND compte_rendu IS NOT NULL
            AND date_soumission_compte_rendu IS NOT NULL AND LENGTH(TRIM(compte_rendu)) >= 10)
    ),
    CONSTRAINT ck_intervention_date_compte_rendu CHECK (
        (compte_rendu IS NULL AND date_soumission_compte_rendu IS NULL)
        OR (compte_rendu IS NOT NULL AND date_soumission_compte_rendu IS NOT NULL)
    ),
    CONSTRAINT ck_intervention_period CHECK (date_heure_fin IS NULL OR date_heure_debut IS NULL OR date_heure_fin >= date_heure_debut)
);

CREATE OR REPLACE FUNCTION verifier_auteur_compte_rendu() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.compte_rendu IS NOT NULL OR NEW.statut_intervention = 'TERMINEE' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM affectation a
              JOIN appartenance_equipe m ON m.id_equipe = a.id_equipe
             WHERE a.id_affectation = NEW.id_affectation
               AND m.id_utilisateur = NEW.renseigne_par
               AND m.fonction IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
               AND m.date_debut <= NEW.date_soumission_compte_rendu
               AND (m.date_fin IS NULL OR m.date_fin >= NEW.date_soumission_compte_rendu)
        ) AND NOT EXISTS (
            SELECT 1
              FROM affectation a
              JOIN delegation_decision_equipe d ON d.id_equipe = a.id_equipe
             WHERE a.id_affectation = NEW.id_affectation
               AND d.id_utilisateur_delegue = NEW.renseigne_par
               AND d.type_decision = 'SOUMISSION_COMPTE_RENDU'
               AND d.date_debut <= NEW.date_soumission_compte_rendu
               AND (d.date_fin IS NULL OR d.date_fin >= NEW.date_soumission_compte_rendu)
               AND EXISTS (
                    SELECT 1 FROM appartenance_equipe m
                     WHERE m.id_utilisateur = d.id_utilisateur_delegue
                       AND m.id_equipe = d.id_equipe
                       AND m.fonction NOT IN ('CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN')
                       AND m.date_debut <= NEW.date_soumission_compte_rendu
                       AND (m.date_fin IS NULL OR m.date_fin >= NEW.date_soumission_compte_rendu)
               )
        ) THEN
            RAISE EXCEPTION 'Le compte rendu doit être soumis par le chef ou un membre délégué à cette responsabilité';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verifier_auteur_compte_rendu
    BEFORE INSERT OR UPDATE ON intervention
    FOR EACH ROW EXECUTE FUNCTION verifier_auteur_compte_rendu();

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
    date_ajout TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    etat_publication VARCHAR(20) NOT NULL DEFAULT 'INTERNE'
        CHECK (etat_publication IN ('INTERNE', 'EN_ATTENTE', 'APPROUVEE', 'REFUSEE')),
    reference_photo_publique VARCHAR(255),
    floutage_confirme BOOLEAN NOT NULL DEFAULT FALSE,
    approuve_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_approbation TIMESTAMPTZ,
    CONSTRAINT ck_photo_intervention_publication CHECK (
        (etat_publication = 'APPROUVEE' AND reference_photo_publique IS NOT NULL
            AND floutage_confirme AND approuve_par IS NOT NULL AND date_approbation IS NOT NULL)
        OR (etat_publication <> 'APPROUVEE' AND approuve_par IS NULL AND date_approbation IS NULL)
    )
);

CREATE TABLE publication_flux (
    id_publication UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_signalement UUID REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    id_dossier UUID REFERENCES dossier_traitement(id_dossier) ON DELETE RESTRICT,
    cree_par UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    etat_publication VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
        CHECK (etat_publication IN ('EN_ATTENTE', 'APPROUVEE', 'MASQUEE', 'REFUSEE')),
    approuve_par UUID REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_approbation TIMESTAMPTZ,
    date_publication TIMESTAMPTZ,
    motif_decision TEXT,
    CONSTRAINT ck_publication_cible CHECK (
        (id_signalement IS NOT NULL AND id_dossier IS NULL)
        OR (id_signalement IS NULL AND id_dossier IS NOT NULL)
    ),
    CONSTRAINT ck_publication_approbation CHECK (
        (etat_publication IN ('APPROUVEE', 'MASQUEE') AND approuve_par IS NOT NULL AND date_approbation IS NOT NULL AND date_publication IS NOT NULL)
        OR (etat_publication IN ('EN_ATTENTE', 'REFUSEE') AND approuve_par IS NULL AND date_approbation IS NULL AND date_publication IS NULL)
    )
);

CREATE UNIQUE INDEX uq_publication_signalement ON publication_flux(id_signalement) WHERE id_signalement IS NOT NULL;
CREATE UNIQUE INDEX uq_publication_dossier ON publication_flux(id_dossier) WHERE id_dossier IS NOT NULL;

CREATE TABLE photo_publication (
    id_photo_publication UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_publication UUID NOT NULL REFERENCES publication_flux(id_publication) ON DELETE CASCADE,
    id_photo_signalement UUID REFERENCES photo_signalement(id_photo_signalement) ON DELETE RESTRICT,
    id_photo_intervention UUID REFERENCES photo_intervention(id_photo_intervention) ON DELETE RESTRICT,
    role_photo VARCHAR(15) NOT NULL CHECK (role_photo IN ('OBSERVATION', 'AVANT', 'APRES')),
    date_ajout TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_photo_publication_source CHECK (
        (id_photo_signalement IS NOT NULL AND id_photo_intervention IS NULL AND role_photo IN ('OBSERVATION', 'AVANT'))
        OR (id_photo_signalement IS NULL AND id_photo_intervention IS NOT NULL AND role_photo IN ('AVANT', 'APRES'))
    ),
    CONSTRAINT uq_photo_publication_signalement UNIQUE (id_publication, id_photo_signalement),
    CONSTRAINT uq_photo_publication_intervention UNIQUE (id_publication, id_photo_intervention)
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
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    id_signalement UUID REFERENCES signalement(id_signalement) ON DELETE RESTRICT,
    points INT NOT NULL CHECK (points <> 0),
    date_attribution TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motif VARCHAR(255) NOT NULL,
    type_mouvement VARCHAR(20) NOT NULL CHECK (type_mouvement IN ('ATTRIBUTION', 'COMPENSATION')),
    id_point_origine UUID REFERENCES historique_points(id_point) ON DELETE RESTRICT,
    CONSTRAINT ck_points_mouvement CHECK (
        (type_mouvement = 'ATTRIBUTION' AND points > 0 AND id_point_origine IS NULL)
        OR (type_mouvement = 'COMPENSATION' AND points < 0 AND id_point_origine IS NOT NULL)
    )
);

CREATE INDEX idx_points_user ON historique_points(id_utilisateur);
CREATE UNIQUE INDEX uq_points_attribution_signalement ON historique_points(id_signalement)
    WHERE type_mouvement = 'ATTRIBUTION';
CREATE UNIQUE INDEX uq_points_compensation_origine ON historique_points(id_point_origine)
    WHERE id_point_origine IS NOT NULL;

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

CREATE OR REPLACE FUNCTION verifier_soumission_signalement() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statut_signalement <> 'BROUILLON' THEN
        NEW.date_soumission := COALESCE(NEW.date_soumission, CURRENT_TIMESTAMP);
        IF NEW.latitude IS NULL AND NULLIF(BTRIM(NEW.description_localisation), '') IS NULL THEN
            RAISE EXCEPTION 'Un signalement soumis doit avoir des coordonnées GPS ou un repère textuel';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verifier_soumission_signalement
    BEFORE INSERT OR UPDATE ON signalement
    FOR EACH ROW EXECUTE FUNCTION verifier_soumission_signalement();

CREATE OR REPLACE FUNCTION verifier_photo_publication() RETURNS TRIGGER AS $$
DECLARE
    v_id_signalement UUID;
    v_id_dossier UUID;
    v_etat_photo VARCHAR(20);
    v_contexte_photo VARCHAR(30);
    v_id_signalement_source UUID;
    v_id_dossier_source UUID;
BEGIN
    SELECT id_signalement, id_dossier
      INTO v_id_signalement, v_id_dossier
      FROM publication_flux
     WHERE id_publication = NEW.id_publication;

    IF NEW.id_photo_signalement IS NOT NULL THEN
        SELECT id_signalement, etat_publication
          INTO v_id_signalement_source, v_etat_photo
          FROM photo_signalement
         WHERE id_photo_signalement = NEW.id_photo_signalement;
        IF v_etat_photo IS DISTINCT FROM 'APPROUVEE' THEN
            RAISE EXCEPTION 'La photo source doit être approuvée et floutée';
        END IF;
        IF v_id_signalement IS NOT NULL THEN
            IF v_id_signalement_source <> v_id_signalement OR NEW.role_photo <> 'OBSERVATION' THEN
                RAISE EXCEPTION 'La photo ne correspond pas à la publication du signalement';
            END IF;
        ELSIF NEW.role_photo <> 'AVANT' OR NOT EXISTS (
            SELECT 1 FROM rattachement_signalement r
             WHERE r.id_dossier = v_id_dossier AND r.id_signalement = v_id_signalement_source
        ) THEN
            RAISE EXCEPTION 'La photo avant doit provenir d''un signalement rattaché au dossier';
        END IF;
    ELSE
        SELECT a.id_dossier, pi.etat_publication, pi.contexte_photo
          INTO v_id_dossier_source, v_etat_photo, v_contexte_photo
          FROM photo_intervention pi
          JOIN intervention i ON i.id_intervention = pi.id_intervention
          JOIN affectation a ON a.id_affectation = i.id_affectation
         WHERE pi.id_photo_intervention = NEW.id_photo_intervention;
        IF v_etat_photo IS DISTINCT FROM 'APPROUVEE' OR v_id_dossier_source <> v_id_dossier THEN
            RAISE EXCEPTION 'La photo d''intervention doit être approuvée et appartenir au dossier publié';
        END IF;
        IF NOT (
            (NEW.role_photo = 'AVANT' AND v_contexte_photo IN ('CONSTAT_INITIAL', 'DEBUT_INTERVENTION'))
            OR (NEW.role_photo = 'APRES' AND v_contexte_photo = 'FIN_INTERVENTION')
        ) THEN
            RAISE EXCEPTION 'Le contexte de la photo ne correspond pas à son rôle dans la publication';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verifier_photo_publication
    BEFORE INSERT OR UPDATE ON photo_publication
    FOR EACH ROW EXECUTE FUNCTION verifier_photo_publication();

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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verifier_approbation_publication
    BEFORE INSERT OR UPDATE OF etat_publication ON publication_flux
    FOR EACH ROW EXECUTE FUNCTION verifier_approbation_publication();
