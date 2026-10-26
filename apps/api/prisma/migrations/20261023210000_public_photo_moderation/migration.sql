ALTER TABLE photo_signalement
    ADD COLUMN variante_soumise_par UUID
    REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT;

ALTER TABLE photo_intervention
    ADD COLUMN variante_soumise_par UUID
    REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT;
