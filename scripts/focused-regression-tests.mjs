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
assert.match(requestForm, /body: JSON\.stringify\(payload\)/, "training form must submit the FormData payload directly");
assert.match(requestForm, /autoComplete="street-address"/, "training form must include browser autofill hints");
assert.match(
  requestForm,
  /label="Preferred days\/times"[\s\S]*required[\s\S]*textarea/,
  "training form must mark preferred days/times required to match the API",
);
assert.match(requestForm, /name="service_id"/, "training form must submit selected service id");
assert.match(requestForm, /Player profile/, "training form must show profile-owned player details");
assert.doesNotMatch(requestForm, /name="name"/, "training form must not ask for player name every request");
assert.doesNotMatch(requestForm, /name="player_age"/, "training form must not ask for player age every request");
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
assert.match(trainingApi, /isPhoneVerificationBypassed/, "training API must honor the temporary phone bypass");
assert.match(trainingApi, /repairAccountForAuthUser/, "training API must repair account rows before calling the RPC");
assert.match(trainingApi, /accountRequestProfileFrom/, "training API must derive player profile fields server-side");
assert.match(trainingApi, /SERVICE_COACH_MISMATCH/, "training API must verify selected service ownership");
assert.match(trainingApi, /requestId/, "training API success response must include requestId");
assert.match(trainingApi, /conversationId/, "training API success response must include conversationId");

const serviceSelection = read("src/components/ServiceSelectionPanel.tsx");
assert.match(serviceSelection, /type="button"/, "service cards must be clickable buttons");
assert.match(serviceSelection, /aria-pressed=\{selected\}/, "service cards must expose selected state");
assert.match(serviceSelection, /reppy:service-selected/, "service cards must notify the request form");

const authMenu = read("src/components/AuthMenu.tsx");
assert.match(authMenu, /href="\/account\/login"/, "header auth CTA must default to player/parent login");
assert.match(authMenu, /Coach Sign up/, "header auth menu must expose coach signup");

const accountConfig = read("src/lib/accountConfig.ts");
assert.match(accountConfig, /REPPY_DISABLE_PHONE_VERIFICATION/, "account config must define the phone bypass env flag");
assert.match(accountConfig, /NODE_ENV === "production"/, "account config must warn if the bypass is enabled in production");

const authActions = read("src/lib/authActions.ts");
assert.doesNotMatch(authActions, /registerUser[\s\S]*await supabase\.auth\.signOut\(\);/, "registration must not clear existing sessions");
assert.match(authActions, /findAuthUserByEmail/, "account registration must precheck duplicate auth users");
assert.match(authActions, /getUserById/, "account registration must verify the new auth user before app row writes");
assert.match(authActions, /ensureAccountPrivateDetails/, "account registration must check private details upsert errors");

const actions = read("src/lib/actions.ts");
assert.match(actions, /repairAccountForAuthUser/, "account sign-in must repair profile and private details");
assert.match(actions, /isPhoneVerificationBypassed/, "account sign-in must honor the temporary phone bypass");

const health = read("src/app/api/health/supabase/route.ts");
assert.match(health, /publicConfig/, "health endpoint must report public Supabase config state");
assert.match(health, /adminConfig/, "health endpoint must report admin Supabase config state");
assert.match(health, /phoneVerificationBypass/, "health endpoint must report phone verification bypass state");
assert.match(health, /playerProfileRequiredColumns/, "health endpoint must report player profile schema state");
assert.match(health, /trainingRequestRequiredColumns/, "health endpoint must report request schema state");

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
