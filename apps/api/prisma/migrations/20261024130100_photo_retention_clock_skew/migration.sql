CREATE OR REPLACE FUNCTION appliquer_conservation_photo_un_an() RETURNS TRIGGER AS $$
BEGIN
    NEW.date_expiration := NEW.date_ajout + INTERVAL '1 year';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
