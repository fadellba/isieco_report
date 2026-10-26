ALTER TABLE intervention
    DROP CONSTRAINT ck_intervention_exception_reason;

ALTER TABLE intervention
    ADD CONSTRAINT ck_intervention_exception_reason CHECK (
        (
            resultat_intervention = 'SUCCES_TOTAL'
            AND (motif_exception IS NULL OR length(trim(motif_exception)) >= 10)
        )
        OR (
            resultat_intervention IS NOT NULL
            AND resultat_intervention <> 'SUCCES_TOTAL'
            AND motif_exception IS NOT NULL
            AND length(trim(motif_exception)) >= 10
        )
        OR (resultat_intervention IS NULL AND motif_exception IS NULL)
    );
