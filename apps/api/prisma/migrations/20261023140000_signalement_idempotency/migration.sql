CREATE TABLE idempotence_signalement (
    id_utilisateur UUID NOT NULL,
    cle_idempotence VARCHAR(100) NOT NULL,
    empreinte_requete CHAR(64) NOT NULL,
    id_signalement UUID NOT NULL UNIQUE,
    date_creation TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_idempotence_signalement
        PRIMARY KEY (id_utilisateur, cle_idempotence),
    CONSTRAINT fk_idempotence_signalement_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur)
        ON DELETE CASCADE,
    CONSTRAINT fk_idempotence_signalement_signalement
        FOREIGN KEY (id_signalement)
        REFERENCES signalement(id_signalement)
        ON DELETE CASCADE,
    CONSTRAINT ck_idempotence_signalement_key
        CHECK (length(cle_idempotence) BETWEEN 1 AND 100)
);

CREATE INDEX idx_idempotence_signalement_date
    ON idempotence_signalement(date_creation);
