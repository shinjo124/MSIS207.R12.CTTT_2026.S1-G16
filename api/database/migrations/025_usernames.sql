-- Tripo usernames: a public handle people can search for in Messages.
-- Optional; stored lower-case. Clerk sign-in never overwrites it.
ALTER TABLE users
  ADD COLUMN username VARCHAR(20) NULL AFTER display_name,
  ADD UNIQUE KEY uq_users_username (username);
