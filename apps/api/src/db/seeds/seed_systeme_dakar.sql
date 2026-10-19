-- ============================================================================
-- ISI-Eco Report — Jeu de Données de Démonstration Dakar (Seed Système)
-- Personas : traceabilite/personas-demonstration.md
-- Mot de passe unifié pour les tests : Password@123
-- Hash : scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523
-- ============================================================================

-- 1. Rôles Canoniques
INSERT INTO role (id_role, code_role, libelle_role, description) VALUES
('a0000000-0000-0000-0000-000000000001', 'CITOYEN', 'Citoyen', 'Déclarant nomade d''observations de dépôts sauvages'),
('a0000000-0000-0000-0000-000000000002', 'QUALIFICATION', 'Agent de Qualification', 'Examen, recevabilité et détection de doublons des signalements'),
('a0000000-0000-0000-0000-000000000003', 'TRAITEMENT', 'Responsable de Traitement', 'Création et qualification des dossiers opérationnels'),
('a0000000-0000-0000-0000-000000000004', 'AFFECTATION', 'Responsable d''Affectation', 'Assignation des équipes compétentes par volet technique'),
('a0000000-0000-0000-0000-000000000005', 'TERRAIN', 'Agent de Terrain', 'Exécution et compte-rendu des interventions sur site'),
('a0000000-0000-0000-0000-000000000006', 'VERIFICATION', 'Vérificateur de Résolution', 'Contrôle de conformité et décision de clôture ou réouverture'),
('a0000000-0000-0000-0000-000000000007', 'ADMIN', 'Administrateur Système', 'Gestion des comptes utilisateurs et référentiels'),
('a0000000-0000-0000-0000-000000000008', 'DECISION', 'Décideur / Élu Territorial', 'Consultation cartographie et indicateurs statistiques')
ON CONFLICT (code_role) DO NOTHING;

-- 2. Utilisateurs Personas Dakar
INSERT INTO utilisateur (id_utilisateur, nom, prenom, email, telephone, mot_de_passe_hash, date_inscription, etat_compte) VALUES
('00000000-0000-0000-0000-000000000001', 'Diallo', 'Awa', 'citoyen@isieco.sn', '+221770000001', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000002', 'Ndiaye', 'Moussa', 'qualif@isieco.sn', '+221770000002', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000003', 'Sow', 'Ibrahima', 'traitement@isieco.sn', '+221770000003', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000004', 'Ba', 'Fatou', 'affectation@isieco.sn', '+221770000004', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000005', 'Fall', 'Modou', 'terrain@isieco.sn', '+221770000005', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000006', 'Cissé', 'Khady', 'verification@isieco.sn', '+221770000006', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000007', 'Diop', 'Cheikh Anta', 'admin@isieco.sn', '+221770000007', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000008', 'Touré', 'Aminata', 'decision@isieco.sn', '+221770000008', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000009', 'Sarr', 'Oumar', 'inactif@isieco.sn', '+221770000009', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'INACTIF'),

('00000000-0000-0000-0000-000000000010', 'Seck', 'Babacar', 'citoyen2@isieco.sn', '+221770000010', 
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523', 
 '2026-01-01 08:00:00+00', 'ACTIF'),

('00000000-0000-0000-0000-000000000011', 'Operations', 'Equipe', 'operations@isieco.sn', '+221770000011',
 'scrypt$c4977c729ed1c8988a634b779a6e529d$53cfe49a00903aa1ba64da10b32dbc2d0a829b2c99d3bfe86df1f1d16b162eaacc1eeca884d75a26fc32a8960a0d264adadc4a4eb4316df8df7d75cdc9af7523',
 '2026-01-01 08:00:00+00', 'ACTIF')
ON CONFLICT (email) DO NOTHING;

-- 3. Attributions des Rôles
INSERT INTO utilisateur_role (id_utilisateur, id_role, date_debut) VALUES
('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2026-01-01 08:00:00+00'), -- Awa -> CITOYEN
('00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '2026-01-01 08:00:00+00'), -- Moussa -> QUALIFICATION
('00000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '2026-01-01 08:00:00+00'), -- Ibrahima -> TRAITEMENT
('00000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '2026-01-01 08:00:00+00'), -- Fatou -> AFFECTATION
('00000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', '2026-01-01 08:00:00+00'), -- Modou -> TERRAIN
('00000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', '2026-01-01 08:00:00+00'), -- Khady -> VERIFICATION
('00000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', '2026-01-01 08:00:00+00'), -- Cheikh Anta -> ADMIN
('00000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', '2026-01-01 08:00:00+00'), -- Aminata -> DECISION
('00000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', '2026-01-01 08:00:00+00'), -- Oumar (Inactif) -> CITOYEN
('00000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', '2026-01-01 08:00:00+00')  -- Babacar -> CITOYEN
ON CONFLICT DO NOTHING;

INSERT INTO utilisateur_role (id_utilisateur, id_role, date_debut) VALUES
('00000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', '2026-01-01 08:00:00+00'),
('00000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', '2026-01-01 08:00:00+00'),
('00000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000004', '2026-01-01 08:00:00+00'),
('00000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', '2026-01-01 08:00:00+00'),
('00000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000006', '2026-01-01 08:00:00+00'),
('00000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000008', '2026-01-01 08:00:00+00')
ON CONFLICT DO NOTHING;

-- 4. Types de Déchets (Catégories)
INSERT INTO type_dechet (id_type_dechet, code_type, libelle, description, orientation_specialisee, date_debut_validite) VALUES
('10000000-0000-0000-0000-000000000001', 'PLASTIQUE', 'Déchets Plastiques', 'Bouteilles, sachets, emballages et polymères non biodégradables', FALSE, '2026-01-01 00:00:00+00'),
('10000000-0000-0000-0000-000000000002', 'ORGANIQUE', 'Déchets Organiques', 'Restes alimentaires, déchets de marché et matières putrescibles', FALSE, '2026-01-01 00:00:00+00'),
('10000000-0000-0000-0000-000000000003', 'ELECTRONIQUE', 'Déchets Électroniques (D3E)', 'Appareils électriques, téléphones, composants et câblages', TRUE, '2026-01-01 00:00:00+00'),
('10000000-0000-0000-0000-000000000004', 'GRAVATS', 'Gravats et Déblais de Chantier', 'Béton, briques, gravats de démolition et sables', TRUE, '2026-01-01 00:00:00+00'),
('10000000-0000-0000-0000-000000000005', 'METAUX', 'Ferrailles et Métaux', 'Épaves métalliques, tôles et ferrailles industrielles', TRUE, '2026-01-01 00:00:00+00')
ON CONFLICT (code_type) DO NOTHING;

-- 5. Équipes d'Intervention Dakar
INSERT INTO equipe (id_equipe, nom_equipe, description, etat_equipe) VALUES
('20000000-0000-0000-0000-000000000001', 'Équipe Plastique Dakar-Plateau', 'Unité spécialisée dans la collecte sélective des plastiques en milieu urbain dense', 'ACTIVE'),
('20000000-0000-0000-0000-000000000002', 'Équipe Bio-Déchets Médina', 'Équipe d''assainissement et curage dédiée aux déchets organiques et marchés de Médina', 'ACTIVE'),
('20000000-0000-0000-0000-000000000003', 'Équipe Déblaiement & Encombrants Littoral', 'Équipage équipé de bennes pour gravats lourds et ferrailles', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- 6. Appartenance d'agents aux équipes
INSERT INTO appartenance_equipe (id_utilisateur, id_equipe, date_debut, fonction) VALUES
('00000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '2026-01-01 08:00:00+00', 'CHEF_EQUIPE_TERRAIN')
ON CONFLICT DO NOTHING;

INSERT INTO appartenance_equipe (id_utilisateur, id_equipe, date_debut, fonction) VALUES
('00000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '2026-01-01 08:00:00+00', 'AGENT_TERRAIN'),
('00000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', '2026-01-01 08:00:00+00', 'AGENT_TERRAIN')
ON CONFLICT DO NOTHING;

-- 7. Compétences des Équipes (Certifiées et Actives)
INSERT INTO competence_equipe (id_competence_equipe, id_equipe, id_type_dechet, date_debut, commentaire, validee_par) VALUES
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 
 '2026-01-01 00:00:00+00', 'Certification Tri et Collecte Plastique Ville de Dakar', '00000000-0000-0000-0000-000000000007'),

('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 
 '2026-01-01 00:00:00+00', 'Agrément Salubrité Organique et Compostage', '00000000-0000-0000-0000-000000000007'),

('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 
 '2026-01-01 00:00:00+00', 'Habilitation Déblaiement Lourd et BTP', '00000000-0000-0000-0000-000000000007'),

('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 
 '2026-01-01 00:00:00+00', 'Agrément Récupération Ferrailles et Métaux', '00000000-0000-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- Compétence Expirée (Pour validation test d'acceptation T07)
INSERT INTO competence_equipe (id_competence_equipe, id_equipe, id_type_dechet, date_debut, date_fin, commentaire, validee_par) VALUES
('30000000-0000-0000-0000-000000000099', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 
 '2025-01-01 00:00:00+00', '2025-12-31 23:59:59+00', 'Habilitation Électronique expirée fin 2025 (Test T07)', '00000000-0000-0000-0000-000000000007')
ON CONFLICT DO NOTHING;
