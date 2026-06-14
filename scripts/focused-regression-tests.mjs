import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const requestForm = read("src/components/RequestTrainingForm.tsx");
assert.match(requestForm, /const form = event\.currentTarget;/, "training form must preserve form before await");
assert.match(requestForm, /const formData = new FormData\(form\);/, "training form must read FormData from preserved form");
assert.match(requestForm, /form\.reset\(\);/, "training form must reset the preserved form only after success");
assert.doesNotMatch(requestForm, /event\.currentTarget\.reset\(\)/, "training form must not reset event.currentTarget after await");
assert.match(requestForm, /client_request_id/, "training form must submit a stable idempotency key");
assert.match(requestForm, /aria-live="polite"/, "training form must expose async status accessibly");

const trainingApi = read("src/app/api/training-requests/route.ts");
for (const code of [
  "AUTH_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "PHONE_NOT_VERIFIED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
]) {
  assert.match(trainingApi, new RegExp(code), `training API must standardize ${code}`);
}
assert.match(trainingApi, /create_training_request_verified/, "training API must use the idempotent verified RPC");
assert.match(trainingApi, /requestId/, "training API success response must include requestId");
assert.match(trainingApi, /conversationId/, "training API success response must include conversationId");

const realtime = read("src/components/RealtimeRefresh.tsx");
assert.match(realtime, /conversationId\?: string/, "RealtimeRefresh must accept an optional conversationId");
assert.match(realtime, /event: "UPDATE"/, "RealtimeRefresh must listen to participant updates");
assert.match(realtime, /unreadCount > 0/, "RealtimeRefresh must ignore mark-read updates that set unread to zero");
assert.match(realtime, /table: "messages"/, "RealtimeRefresh must subscribe to open-thread message inserts");
assert.match(realtime, /setTimeout/, "RealtimeRefresh must debounce refreshes");
assert.match(realtime, /removeChannel/, "RealtimeRefresh must clean up channels");

const data = read("src/lib/data.ts");
assert.match(data, /\.gt\("unread_count", 0\)/, "mark-read updates must only write when unread_count is positive");
assert.match(data, /\.eq\("is_unread_by_coach", true\)/, "legacy coach unread field must only update when currently unread");

console.log("Focused regression tests passed.");
