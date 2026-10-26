ALTER TABLE rattachement_signalement
    DROP CONSTRAINT IF EXISTS rattachement_signalement_type_rattachement_check;

ALTER TABLE rattachement_signalement
    ADD CONSTRAINT ck_rattachement_type
    CHECK (type_rattachement IN ('PRINCIPAL', 'CONFIRMATION', 'COMPLEMENT', 'DOUBLON_CONFIRME'));
