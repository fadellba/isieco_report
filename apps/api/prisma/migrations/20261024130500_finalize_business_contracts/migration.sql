ALTER TABLE contenu_dossier
    DROP CONSTRAINT ck_contenu_dossier_origine_ajout;

ALTER TABLE contenu_dossier
    ADD CONSTRAINT ck_contenu_dossier_origine_ajout CHECK (
        origine_ajout IN (
            'SIGNALEMENT',
            'CREATION_DOSSIER',
            'AJOUT_MANUEL',
            'HISTORIQUE_NON_DETERMINE'
        )
    );

UPDATE photo_signalement
   SET media_stockee_locale = TRUE
 WHERE reference_photo ~* '^[0-9a-f-]{36}\.(jpg|png|webp)$';

UPDATE photo_intervention
   SET media_stockee_locale = TRUE
 WHERE reference_photo ~* '^[0-9a-f-]{36}\.(jpg|png|webp)$';

UPDATE photo_signalement
   SET media_purge_at = date_expiration
 WHERE NOT media_stockee_locale
   AND date_expiration <= CURRENT_TIMESTAMP;

UPDATE photo_intervention
   SET media_purge_at = date_expiration
 WHERE NOT media_stockee_locale
   AND date_expiration <= CURRENT_TIMESTAMP;
