ALTER TABLE contenu_dossier
    DROP CONSTRAINT ck_contenu_dossier_motif_ajout;

ALTER TABLE contenu_dossier
    ADD CONSTRAINT ck_contenu_dossier_motif_ajout CHECK (
        (origine_ajout = 'AJOUT_MANUEL' AND motif_ajout IS NOT NULL AND length(trim(motif_ajout)) >= 10)
        OR (origine_ajout <> 'AJOUT_MANUEL' AND motif_ajout IS NULL)
    );
