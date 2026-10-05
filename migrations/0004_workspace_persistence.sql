CREATE TABLE canonical_workspace_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 settings jsonb, preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 shipping_model_version text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO canonical_workspace_state(singleton) VALUES(true);
CREATE TABLE canonical_workspace_requests (
 request_id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('patch','import')),
 payload jsonb NOT NULL, result jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_fact BEFORE UPDATE OR DELETE ON canonical_workspace_requests
 FOR EACH ROW EXECUTE FUNCTION canonical_immutable();
