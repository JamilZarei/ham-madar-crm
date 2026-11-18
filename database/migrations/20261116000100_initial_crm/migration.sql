-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "workspace_id" UUID NOT NULL,
    "sms_sender_display" TEXT NOT NULL DEFAULT '',
    "otp_preview_template" TEXT NOT NULL DEFAULT 'کد-ورود',
    "sms_demo_quota" INTEGER NOT NULL DEFAULT 250,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "mobile_e164" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "task_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "code" TEXT NOT NULL,
    "label_fa" TEXT NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "workspace_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_code" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("workspace_id","role_id","permission_code")
);

-- CreateTable
CREATE TABLE "otp_challenge" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_verifier" BYTEA NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resend_after_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "invalidated_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),

    CONSTRAINT "otp_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_throttle" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_throttle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "auth_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "industry" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "mobile_e164" TEXT NOT NULL,
    "email" TEXT,
    "company_id" UUID,
    "owner_membership_id" UUID,
    "job_title" TEXT,
    "status_code" TEXT NOT NULL,
    "source_code" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tag" (
    "workspace_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "contact_tag_pkey" PRIMARY KEY ("workspace_id","contact_id","tag_id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "mobile_e164" TEXT NOT NULL,
    "email" TEXT,
    "company_id" UUID,
    "owner_membership_id" UUID,
    "source_code" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'new',
    "score" INTEGER NOT NULL DEFAULT 0,
    "last_follow_up_on" DATE,
    "description" TEXT,
    "converted_contact_id" UUID,
    "converted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stage" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "default_probability" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pipeline_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "company_id" UUID,
    "contact_id" UUID,
    "owner_membership_id" UUID,
    "pipeline_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "amount_toman" DECIMAL(20,0) NOT NULL,
    "probability_pct" INTEGER NOT NULL,
    "expected_close_on" DATE,
    "won_at" TIMESTAMPTZ(3),
    "description" TEXT,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_stage_change" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID NOT NULL,
    "changed_by_membership_id" UUID,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_stage_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "contact_id" UUID,
    "assignee_membership_id" UUID NOT NULL,
    "priority_code" TEXT NOT NULL,
    "status_code" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "due_time" TIME(0),
    "completed_at" TIMESTAMPTZ(3),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reminder" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "offset_minutes" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "start_time" TIME(0),
    "contact_id" UUID,
    "created_by_membership_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "contact_id" UUID,
    "company_id" UUID,
    "author_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "description" TEXT,
    "kind_code" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_membership_id" UUID,
    "company_id" UUID,
    "contact_id" UUID,
    "deal_id" UUID,
    "lead_id" UUID,
    "task_id" UUID,
    "note_id" UUID,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "recipient_membership_id" UUID NOT NULL,
    "task_reminder_id" UUID,
    "name" TEXT NOT NULL,
    "body" TEXT,
    "kind_code" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_template" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "sms_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_send" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "template_id" UUID,
    "requested_by_membership_id" UUID,
    "workflow_run_step_id" UUID,
    "source_code" TEXT NOT NULL,
    "mode_code" TEXT NOT NULL DEFAULT 'simulation',
    "message_type_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_send_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_message" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "send_id" UUID NOT NULL,
    "contact_id" UUID,
    "recipient_mobile_e164" TEXT NOT NULL,
    "recipient_name_snapshot" TEXT,
    "rendered_body" TEXT NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'queued',
    "provider_code" TEXT,
    "provider_account_ref" TEXT,
    "provider_message_ref" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_status_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL,
    "provider_code" TEXT,
    "provider_account_ref" TEXT,
    "provider_event_ref" TEXT,
    "attempt_no" INTEGER,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "search_key" TEXT NOT NULL,
    "active_version_id" UUID,
    "next_run_at" TIMESTAMPTZ(3),
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_version" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "created_by_membership_id" UUID,
    "trigger_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_node" (
    "workspace_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "operation_code" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "workflow_node_pkey" PRIMARY KEY ("workspace_id","version_id","node_id")
);

-- CreateTable
CREATE TABLE "workflow_edge" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "branch_code" TEXT NOT NULL DEFAULT 'next',

    CONSTRAINT "workflow_edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_run" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "started_by_membership_id" UUID,
    "mode_code" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "run_key" TEXT NOT NULL,
    "scenario" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "scheduled_for" TIMESTAMPTZ(3),

    CONSTRAINT "workflow_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_run_step" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "node_id" UUID,
    "sequence_no" INTEGER NOT NULL,
    "effect_key" TEXT NOT NULL,
    "outcome_code" TEXT NOT NULL,
    "message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "lease_until" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "workflow_run_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_membership_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "request_id" TEXT NOT NULL,
    "result_code" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "lease_until" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_mobile_e164_key" ON "user_account"("mobile_e164");

-- CreateIndex
CREATE INDEX "membership_user_id_status_code_idx" ON "membership"("user_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "membership_workspace_id_id_key" ON "membership"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_workspace_id_user_id_key" ON "membership"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_workspace_id_id_key" ON "role"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "role_workspace_id_code_key" ON "role"("workspace_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "role_workspace_id_name_key" ON "role"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "otp_challenge_user_id_issued_at_idx" ON "otp_challenge"("user_id", "issued_at");

-- CreateIndex
CREATE INDEX "otp_challenge_expires_at_idx" ON "otp_challenge"("expires_at");

-- CreateIndex
CREATE INDEX "auth_throttle_expires_at_idx" ON "auth_throttle"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_token_hash_key" ON "auth_session"("token_hash");

-- CreateIndex
CREATE INDEX "auth_session_user_id_expires_at_idx" ON "auth_session"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "company_workspace_id_name_id_idx" ON "company"("workspace_id", "name", "id");

-- CreateIndex
CREATE INDEX "company_workspace_id_created_at_id_idx" ON "company"("workspace_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "company_workspace_id_id_key" ON "company"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "contact_workspace_id_status_code_created_at_id_idx" ON "contact"("workspace_id", "status_code", "created_at", "id");

-- CreateIndex
CREATE INDEX "contact_workspace_id_company_id_idx" ON "contact"("workspace_id", "company_id");

-- CreateIndex
CREATE INDEX "contact_workspace_id_owner_membership_id_idx" ON "contact"("workspace_id", "owner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_workspace_id_id_key" ON "contact"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_workspace_id_id_key" ON "tag"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_workspace_id_name_key_key" ON "tag"("workspace_id", "name_key");

-- CreateIndex
CREATE INDEX "contact_tag_workspace_id_tag_id_idx" ON "contact_tag"("workspace_id", "tag_id");

-- CreateIndex
CREATE INDEX "lead_workspace_id_status_code_created_at_id_idx" ON "lead"("workspace_id", "status_code", "created_at", "id");

-- CreateIndex
CREATE INDEX "lead_workspace_id_owner_membership_id_idx" ON "lead"("workspace_id", "owner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_workspace_id_id_key" ON "lead"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_workspace_id_id_key" ON "pipeline"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_workspace_id_name_key" ON "pipeline"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_workspace_id_id_key" ON "pipeline_stage"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_workspace_id_pipeline_id_id_key" ON "pipeline_stage"("workspace_id", "pipeline_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_workspace_id_pipeline_id_code_key" ON "pipeline_stage"("workspace_id", "pipeline_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_workspace_id_pipeline_id_sort_order_key" ON "pipeline_stage"("workspace_id", "pipeline_id", "sort_order");

-- CreateIndex
CREATE INDEX "deal_workspace_id_pipeline_id_stage_id_created_at_idx" ON "deal"("workspace_id", "pipeline_id", "stage_id", "created_at");

-- CreateIndex
CREATE INDEX "deal_workspace_id_won_at_idx" ON "deal"("workspace_id", "won_at");

-- CreateIndex
CREATE INDEX "deal_workspace_id_contact_id_idx" ON "deal"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "deal_workspace_id_company_id_idx" ON "deal"("workspace_id", "company_id");

-- CreateIndex
CREATE INDEX "deal_workspace_id_owner_membership_id_idx" ON "deal"("workspace_id", "owner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_workspace_id_id_key" ON "deal"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "deal_stage_change_workspace_id_deal_id_changed_at_idx" ON "deal_stage_change"("workspace_id", "deal_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "deal_stage_change_workspace_id_id_key" ON "deal_stage_change"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "task_workspace_id_assignee_membership_id_status_code_due_da_idx" ON "task"("workspace_id", "assignee_membership_id", "status_code", "due_date", "id");

-- CreateIndex
CREATE INDEX "task_workspace_id_due_date_idx" ON "task"("workspace_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "task_workspace_id_id_key" ON "task"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "task_reminder_workspace_id_status_code_scheduled_at_idx" ON "task_reminder"("workspace_id", "status_code", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminder_workspace_id_id_key" ON "task_reminder"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminder_workspace_id_task_id_key" ON "task_reminder"("workspace_id", "task_id");

-- CreateIndex
CREATE INDEX "calendar_event_workspace_id_event_date_id_idx" ON "calendar_event"("workspace_id", "event_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_workspace_id_id_key" ON "calendar_event"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "note_workspace_id_contact_id_created_at_idx" ON "note"("workspace_id", "contact_id", "created_at");

-- CreateIndex
CREATE INDEX "note_workspace_id_company_id_created_at_idx" ON "note"("workspace_id", "company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "note_workspace_id_id_key" ON "note"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "activity_workspace_id_contact_id_occurred_at_idx" ON "activity"("workspace_id", "contact_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_workspace_id_company_id_occurred_at_idx" ON "activity"("workspace_id", "company_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_workspace_id_occurred_at_id_idx" ON "activity"("workspace_id", "occurred_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_workspace_id_id_key" ON "activity"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_workspace_id_note_id_key" ON "activity"("workspace_id", "note_id");

-- CreateIndex
CREATE INDEX "notification_workspace_id_recipient_membership_id_created_a_idx" ON "notification"("workspace_id", "recipient_membership_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_workspace_id_id_key" ON "notification"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_workspace_id_task_reminder_id_key" ON "notification"("workspace_id", "task_reminder_id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_template_workspace_id_id_key" ON "sms_template"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "sms_send_workspace_id_requested_at_id_idx" ON "sms_send"("workspace_id", "requested_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_send_workspace_id_id_key" ON "sms_send"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_send_workspace_id_idempotency_key_key" ON "sms_send"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sms_message_workspace_id_status_code_created_at_idx" ON "sms_message"("workspace_id", "status_code", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sms_message_workspace_id_id_key" ON "sms_message"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_message_workspace_id_send_id_recipient_mobile_e164_key" ON "sms_message"("workspace_id", "send_id", "recipient_mobile_e164");

-- CreateIndex
CREATE INDEX "sms_status_event_workspace_id_message_id_occurred_at_idx" ON "sms_status_event"("workspace_id", "message_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "sms_status_event_workspace_id_id_key" ON "sms_status_event"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_status_event_provider_code_provider_account_ref_provide_key" ON "sms_status_event"("provider_code", "provider_account_ref", "provider_event_ref");

-- CreateIndex
CREATE INDEX "workflow_workspace_id_next_run_at_idx" ON "workflow"("workspace_id", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_workspace_id_id_key" ON "workflow"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "workflow_version_workspace_id_trigger_code_idx" ON "workflow_version"("workspace_id", "trigger_code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_version_workspace_id_id_key" ON "workflow_version"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_version_workspace_id_workflow_id_id_key" ON "workflow_version"("workspace_id", "workflow_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_version_workspace_id_workflow_id_revision_no_key" ON "workflow_version"("workspace_id", "workflow_id", "revision_no");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edge_workspace_id_id_key" ON "workflow_edge"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edge_workspace_id_version_id_source_node_id_target_key" ON "workflow_edge"("workspace_id", "version_id", "source_node_id", "target_node_id", "branch_code");

-- CreateIndex
CREATE INDEX "workflow_run_workspace_id_version_id_started_at_idx" ON "workflow_run"("workspace_id", "version_id", "started_at");

-- CreateIndex
CREATE INDEX "workflow_run_workspace_id_started_at_idx" ON "workflow_run"("workspace_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_run_workspace_id_id_key" ON "workflow_run"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_run_workspace_id_version_id_id_key" ON "workflow_run"("workspace_id", "version_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_run_workspace_id_run_key_key" ON "workflow_run"("workspace_id", "run_key");

-- CreateIndex
CREATE INDEX "workflow_run_step_workspace_id_outcome_code_next_attempt_at_idx" ON "workflow_run_step"("workspace_id", "outcome_code", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_run_step_workspace_id_id_key" ON "workflow_run_step"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_run_step_workspace_id_run_id_sequence_no_key" ON "workflow_run_step"("workspace_id", "run_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_run_step_workspace_id_effect_key_key" ON "workflow_run_step"("workspace_id", "effect_key");

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_occurred_at_idx" ON "audit_log"("workspace_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_log_workspace_id_id_key" ON "audit_log"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "outbox_event_workspace_id_available_at_completed_at_idx" ON "outbox_event"("workspace_id", "available_at", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_workspace_id_id_key" ON "outbox_event"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_workspace_id_event_key_key" ON "outbox_event"("workspace_id", "event_key");

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_workspace_id_role_id_fkey" FOREIGN KEY ("workspace_id", "role_id") REFERENCES "role"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_workspace_id_role_id_fkey" FOREIGN KEY ("workspace_id", "role_id") REFERENCES "role"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permission"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "otp_challenge" ADD CONSTRAINT "otp_challenge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_workspace_id_company_id_fkey" FOREIGN KEY ("workspace_id", "company_id") REFERENCES "company"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_workspace_id_owner_membership_id_fkey" FOREIGN KEY ("workspace_id", "owner_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_workspace_id_tag_id_fkey" FOREIGN KEY ("workspace_id", "tag_id") REFERENCES "tag"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_company_id_fkey" FOREIGN KEY ("workspace_id", "company_id") REFERENCES "company"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_owner_membership_id_fkey" FOREIGN KEY ("workspace_id", "owner_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_converted_contact_id_fkey" FOREIGN KEY ("workspace_id", "converted_contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_workspace_id_pipeline_id_fkey" FOREIGN KEY ("workspace_id", "pipeline_id") REFERENCES "pipeline"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_workspace_id_company_id_fkey" FOREIGN KEY ("workspace_id", "company_id") REFERENCES "company"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_workspace_id_owner_membership_id_fkey" FOREIGN KEY ("workspace_id", "owner_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_workspace_id_pipeline_id_fkey" FOREIGN KEY ("workspace_id", "pipeline_id") REFERENCES "pipeline"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_workspace_id_pipeline_id_stage_id_fkey" FOREIGN KEY ("workspace_id", "pipeline_id", "stage_id") REFERENCES "pipeline_stage"("workspace_id", "pipeline_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal_stage_change" ADD CONSTRAINT "deal_stage_change_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal_stage_change" ADD CONSTRAINT "deal_stage_change_workspace_id_deal_id_fkey" FOREIGN KEY ("workspace_id", "deal_id") REFERENCES "deal"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal_stage_change" ADD CONSTRAINT "deal_stage_change_workspace_id_from_stage_id_fkey" FOREIGN KEY ("workspace_id", "from_stage_id") REFERENCES "pipeline_stage"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal_stage_change" ADD CONSTRAINT "deal_stage_change_workspace_id_to_stage_id_fkey" FOREIGN KEY ("workspace_id", "to_stage_id") REFERENCES "pipeline_stage"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deal_stage_change" ADD CONSTRAINT "deal_stage_change_workspace_id_changed_by_membership_id_fkey" FOREIGN KEY ("workspace_id", "changed_by_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_assignee_membership_id_fkey" FOREIGN KEY ("workspace_id", "assignee_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_reminder" ADD CONSTRAINT "task_reminder_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_reminder" ADD CONSTRAINT "task_reminder_workspace_id_task_id_fkey" FOREIGN KEY ("workspace_id", "task_id") REFERENCES "task"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_workspace_id_created_by_membership_id_fkey" FOREIGN KEY ("workspace_id", "created_by_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_workspace_id_company_id_fkey" FOREIGN KEY ("workspace_id", "company_id") REFERENCES "company"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_workspace_id_author_membership_id_fkey" FOREIGN KEY ("workspace_id", "author_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_company_id_fkey" FOREIGN KEY ("workspace_id", "company_id") REFERENCES "company"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_deal_id_fkey" FOREIGN KEY ("workspace_id", "deal_id") REFERENCES "deal"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_lead_id_fkey" FOREIGN KEY ("workspace_id", "lead_id") REFERENCES "lead"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_task_id_fkey" FOREIGN KEY ("workspace_id", "task_id") REFERENCES "task"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_note_id_fkey" FOREIGN KEY ("workspace_id", "note_id") REFERENCES "note"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_actor_membership_id_fkey" FOREIGN KEY ("workspace_id", "actor_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspace_id_recipient_membership_id_fkey" FOREIGN KEY ("workspace_id", "recipient_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspace_id_task_reminder_id_fkey" FOREIGN KEY ("workspace_id", "task_reminder_id") REFERENCES "task_reminder"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_template" ADD CONSTRAINT "sms_template_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_send" ADD CONSTRAINT "sms_send_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_send" ADD CONSTRAINT "sms_send_workspace_id_template_id_fkey" FOREIGN KEY ("workspace_id", "template_id") REFERENCES "sms_template"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_send" ADD CONSTRAINT "sms_send_workspace_id_requested_by_membership_id_fkey" FOREIGN KEY ("workspace_id", "requested_by_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_send" ADD CONSTRAINT "sms_send_workspace_id_workflow_run_step_id_fkey" FOREIGN KEY ("workspace_id", "workflow_run_step_id") REFERENCES "workflow_run_step"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_message" ADD CONSTRAINT "sms_message_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_message" ADD CONSTRAINT "sms_message_workspace_id_send_id_fkey" FOREIGN KEY ("workspace_id", "send_id") REFERENCES "sms_send"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_message" ADD CONSTRAINT "sms_message_workspace_id_contact_id_fkey" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "contact"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_status_event" ADD CONSTRAINT "sms_status_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sms_status_event" ADD CONSTRAINT "sms_status_event_workspace_id_message_id_fkey" FOREIGN KEY ("workspace_id", "message_id") REFERENCES "sms_message"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_workspace_id_id_active_version_id_fkey" FOREIGN KEY ("workspace_id", "id", "active_version_id") REFERENCES "workflow_version"("workspace_id", "workflow_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workspace_id_workflow_id_fkey" FOREIGN KEY ("workspace_id", "workflow_id") REFERENCES "workflow"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workspace_id_created_by_membership_id_fkey" FOREIGN KEY ("workspace_id", "created_by_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_node" ADD CONSTRAINT "workflow_node_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_node" ADD CONSTRAINT "workflow_node_workspace_id_version_id_fkey" FOREIGN KEY ("workspace_id", "version_id") REFERENCES "workflow_version"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_workspace_id_version_id_fkey" FOREIGN KEY ("workspace_id", "version_id") REFERENCES "workflow_version"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_workspace_id_version_id_source_node_id_fkey" FOREIGN KEY ("workspace_id", "version_id", "source_node_id") REFERENCES "workflow_node"("workspace_id", "version_id", "node_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_workspace_id_version_id_target_node_id_fkey" FOREIGN KEY ("workspace_id", "version_id", "target_node_id") REFERENCES "workflow_node"("workspace_id", "version_id", "node_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workspace_id_version_id_fkey" FOREIGN KEY ("workspace_id", "version_id") REFERENCES "workflow_version"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workspace_id_started_by_membership_id_fkey" FOREIGN KEY ("workspace_id", "started_by_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_run_step" ADD CONSTRAINT "workflow_run_step_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_run_step" ADD CONSTRAINT "workflow_run_step_workspace_id_version_id_run_id_fkey" FOREIGN KEY ("workspace_id", "version_id", "run_id") REFERENCES "workflow_run"("workspace_id", "version_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workflow_run_step" ADD CONSTRAINT "workflow_run_step_workspace_id_version_id_node_id_fkey" FOREIGN KEY ("workspace_id", "version_id", "node_id") REFERENCES "workflow_node"("workspace_id", "version_id", "node_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_actor_membership_id_fkey" FOREIGN KEY ("workspace_id", "actor_membership_id") REFERENCES "membership"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Domain checks and stable business keys.
CREATE UNIQUE INDEX contact_live_mobile ON contact(workspace_id, mobile_e164) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX pipeline_live_default ON pipeline(workspace_id) WHERE is_default AND deleted_at IS NULL;
CREATE UNIQUE INDEX workflow_single_condition_branch ON workflow_edge(workspace_id, version_id, source_node_id, branch_code)
  WHERE branch_code IN ('yes','no');
CREATE UNIQUE INDEX workflow_single_trigger ON workflow_node(workspace_id, version_id) WHERE kind = 'trigger';
CREATE INDEX outbox_due ON outbox_event (available_at) WHERE completed_at IS NULL AND failed_at IS NULL;
ALTER TABLE contact ADD CONSTRAINT contact_mobile_canonical CHECK (mobile_e164 ~ '^\+989[0-9]{9}$');
ALTER TABLE user_account ADD CONSTRAINT user_mobile_canonical CHECK (mobile_e164 ~ '^\+989[0-9]{9}$');
ALTER TABLE lead ADD CONSTRAINT lead_score_and_conversion CHECK (
  score BETWEEN 0 AND 100 AND ((status_code = 'converted') = (converted_contact_id IS NOT NULL AND converted_at IS NOT NULL))
  AND (converted_contact_id IS NULL) = (converted_at IS NULL));
ALTER TABLE deal ADD CONSTRAINT deal_probability_and_amount CHECK (
  probability_pct BETWEEN 0 AND 100 AND amount_toman >= 0 AND amount_toman <> 'NaN'::numeric);
ALTER TABLE pipeline_stage ADD CONSTRAINT pipeline_stage_kind CHECK (kind IN ('open','won','lost') AND default_probability BETWEEN 0 AND 100);
ALTER TABLE note ADD CONSTRAINT note_single_target CHECK (num_nonnulls(contact_id, company_id) = 1);
ALTER TABLE workflow_edge ADD CONSTRAINT valid_workflow_edge CHECK (
  source_node_id <> target_node_id AND branch_code IN ('next','yes','no'));
ALTER TABLE sms_message ADD CONSTRAINT sms_units_positive CHECK (unit_count > 0);
ALTER TABLE workspace_settings ADD CONSTRAINT workspace_sms_quota CHECK (sms_demo_quota >= 0);

-- Policies reject missing tenant context. The HTTP and worker roles must not be table owners.
CREATE FUNCTION hamsir_workspace() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('hamsir.workspace_id', true), '')::uuid
$$;
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON workspace USING (id = hamsir_workspace()) WITH CHECK (id = hamsir_workspace());
CREATE POLICY workspace_worker_discovery ON workspace FOR SELECT USING (current_setting('hamsir.worker', true) = 'on');
ALTER TABLE "workspace_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workspace_settings" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "membership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "membership" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "role" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "role" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "role_permission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "role_permission" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "company" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "company" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "contact" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "contact" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "tag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "tag" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "contact_tag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "contact_tag" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "lead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "lead" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "pipeline" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "pipeline" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "pipeline_stage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "pipeline_stage" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "deal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "deal" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "deal_stage_change" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "deal_stage_change" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "task" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "task_reminder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "task_reminder" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "calendar_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "calendar_event" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "note" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "note" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "activity" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "notification" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "sms_template" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "sms_template" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "sms_send" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "sms_send" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "sms_message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "sms_message" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "sms_status_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "sms_status_event" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "workflow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workflow" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "workflow_version" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workflow_version" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "workflow_node" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workflow_node" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "workflow_edge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workflow_edge" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "workflow_run" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workflow_run" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "workflow_run_step" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "workflow_run_step" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_workspace_read ON audit_log FOR SELECT USING (workspace_id = hamsir_workspace());
CREATE POLICY audit_workspace_insert ON audit_log FOR INSERT WITH CHECK (workspace_id = hamsir_workspace());
ALTER TABLE "outbox_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_boundary ON "outbox_event" USING (workspace_id = hamsir_workspace()) WITH CHECK (workspace_id = hamsir_workspace());
CREATE POLICY membership_signin ON membership FOR SELECT
  USING (user_id = nullif(current_setting('hamsir.user_id', true), '')::uuid);

