-- Preserve active sessions while removing plaintext bearer tokens from storage.
UPDATE session
SET token = encode(digest(token, 'sha256'), 'hex');

ALTER TABLE session
  ALTER COLUMN token TYPE VARCHAR(64);
