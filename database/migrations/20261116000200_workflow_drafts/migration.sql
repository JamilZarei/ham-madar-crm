ALTER TABLE workflow_version ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX workflow_saved_versions ON workflow_version (workspace_id, workflow_id, revision_no DESC) WHERE NOT is_draft;

