ALTER TABLE qualification_signalement
    RENAME COLUMN quantite_estimee TO quantite_estimee_legacy;

ALTER TABLE qualification_signalement
    ALTER COLUMN quantite_estimee_legacy TYPE VARCHAR(50),
    ADD COLUMN quantite_estimee NUMERIC(12, 3),
    ADD COLUMN unite_quantite VARCHAR(30),
    ADD CONSTRAINT ck_qualification_quantite_unite CHECK (
        (quantite_estimee IS NULL AND unite_quantite IS NULL)
        OR (quantite_estimee IS NOT NULL AND quantite_estimee >= 0
            AND unite_quantite IS NOT NULL AND btrim(unite_quantite) <> '')
    );

ALTER TABLE contenu_dossier
    RENAME COLUMN quantite_estimee TO quantite_estimee_legacy;

ALTER TABLE contenu_dossier
    ALTER COLUMN quantite_estimee_legacy TYPE VARCHAR(50),
    ADD COLUMN quantite_estimee NUMERIC(12, 3),
    ADD COLUMN unite_quantite VARCHAR(30),
    ADD CONSTRAINT ck_contenu_dossier_quantite_unite CHECK (
        (quantite_estimee IS NULL AND unite_quantite IS NULL)
        OR (quantite_estimee IS NOT NULL AND quantite_estimee >= 0
            AND unite_quantite IS NOT NULL AND btrim(unite_quantite) <> '')
    );
