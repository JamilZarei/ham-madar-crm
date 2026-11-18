import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID as id } from "node:crypto";
import { phone, dateOnly } from "@backend/lib/validations/common";
import { localInstant } from "@backend/features/crm/domain";
import { simulateWorkflow, validateWorkflow, initialScenario } from "@shared/workflow";
import type { Workflow } from "@shared/model";
import { requirePermission, type Actor } from "@backend/lib/permissions/policy";

test("normalizes Persian mobile numbers and strictly validates dates and financial timezone edges", () => {
  assert.equal(phone.parse("۰۹۱۲۳۴۵۶۷۸۹"), "+989123456789");
  assert.equal(phone.safeParse("02123456789").success, false);
  assert.throws(() => dateOnly("2026-02-30"));
  assert.equal(localInstant(dateOnly("2026-11-16"), new Date("1970-01-01T00:00:00Z"), "Asia/Tehran").toISOString(), "2026-11-15T20:30:00.000Z");
});
test("authorization checks capabilities from persisted grants", () => {
  const actor: Actor = { userId: id(), workspaceId: id(), membershipId: id(), name: "آزمون", role: "test", grants: new Set(["crm.read"]) };
  assert.doesNotThrow(() => requirePermission(actor, "crm.read"));
  assert.throws(() => requirePermission(actor, "members.manage"), { code: "FORBIDDEN" });
});
test("workflow validation detects cycles and simulation preserves exact deal threshold", () => {
  const trigger = id(); const condition = id(); const action = id();
  const flow: Workflow = { id: id(), name: "آزمون", created: "", description: "", enabled: false, runs: [],
    nodes: [
      { id: trigger, kind: "trigger", value: "", operation: "ایجاد فرصت فروش", position: { x: 0, y: 0 } },
      { id: condition, kind: "condition", value: "9999999999999999998", operation: "ارزش معامله بیشتر است", position: { x: 1, y: 1 } },
      { id: action, kind: "action", value: "آزمون", operation: "ایجاد وظیفه", position: { x: 2, y: 2 } },
    ], links: [{ id: id(), source: trigger, target: condition }, { id: id(), source: condition, target: action, branch: "yes" }] };
  assert.deepEqual(validateWorkflow(flow), []);
  assert.equal(simulateWorkflow(flow, { ...initialScenario, dealValue: "9999999999999999999" }).steps.at(-1)?.result, "موفق");
  flow.links.push({ id: id(), source: action, target: condition });
  assert.ok(validateWorkflow(flow).some((message) => message.includes("حلقوی")));
});
