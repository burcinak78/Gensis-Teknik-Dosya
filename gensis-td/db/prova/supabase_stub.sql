-- The parts of Supabase the live public schema relies on, for the "old side" of the equivalence run:
-- API roles, auth.users and the auth.uid()/auth.role()/auth.jwt() helpers that RLS policies call.
-- PostgREST passes the caller as request.jwt.claims; the equivalence script does the same with
-- SET ROLE authenticated + set_config('request.jwt.claims', ...).

CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;

CREATE SCHEMA auth;

-- Column list of the dumped auth.users data; only id/email/password/sign-in times are read.
CREATE TABLE auth.users (
    instance_id uuid, id uuid PRIMARY KEY, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, invited_at timestamptz, confirmation_token text, confirmation_sent_at timestamptz,
    recovery_token text, recovery_sent_at timestamptz, email_change_token_new text, email_change text,
    email_change_sent_at timestamptz, last_sign_in_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    is_super_admin boolean, created_at timestamptz, updated_at timestamptz, phone text, phone_confirmed_at timestamptz,
    phone_change text, phone_change_token text, phone_change_sent_at timestamptz, email_change_token_current text,
    email_change_confirm_status smallint, banned_until timestamptz, reauthentication_token text,
    reauthentication_sent_at timestamptz, is_sso_user boolean, deleted_at timestamptz, is_anonymous boolean
);

-- Same definitions as Supabase's auth schema.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
