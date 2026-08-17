#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
OUT="${OUT:-api_smoke_results.jsonl}"
: > "$OUT"

post() {
  local op="$1" payload="$2" label="${3:-$1}" body
  body="$(curl -sS --fail-with-body -X POST "$BASE/api/db/$op" -H 'Content-Type: application/json' --data "$payload")"
  printf '%s\n' "{\"label\":\"$label\",\"operation\":\"$op\",\"response\":$body}" >> "$OUT"
  printf '%s\t%s\n' "$label" "$body"
  [[ "$body" == *'"ok":true'* ]]
  printf '%s' "$body"
}

get() {
  local op="$1" label="${2:-$1}" body
  body="$(curl -sS --fail-with-body "$BASE/api/db/$op?_smoke=$(date +%s%N)")"
  printf '%s\n' "{\"label\":\"$label\",\"operation\":\"$op\",\"response\":$body}" >> "$OUT"
  printf '%s\t%s\n' "$label" "$body"
  [[ "$body" == *'"ok":true'* ]]
}

# Read-only route matrix: each must return a valid success envelope.
for op in \
  classes.list students.list lessons.list questions.list prizes.list gifts.list sounds.list \
  celebrations.list settings.get   attendance.list sessions.list \
  gameResults.listRecent backup.list stats.summary; do
  get "$op"
done

# CRUD and lifecycle smoke flow with deterministic cleanup IDs.
CLASS_ID="smoke_class_$(date +%s)"
STUDENT_ID="smoke_student_$(date +%s)"
TODAY="2026-08-13-smoke"

post classes.create "{\"args\":[\"$CLASS_ID\",\"Smoke Class\",\"Automated API smoke test\",\"#0142A0\"]}" "create class" >/tmp/smoke_class_response
post classes.list '{"args":[]}' "list after class create"
post students.upsert "{\"args\":[\"$STUDENT_ID\",\"$CLASS_ID\",{\"name\":\"Smoke Student\",\"points\":0,\"correctAnswers\":0,\"wrongAnswers\":0,\"attempts\":0,\"isAbsent\":false}]}" "upsert student" >/tmp/smoke_student_response
post students.listByClass "{\"args\":[\"$CLASS_ID\"]}" "list class students"
post attendance.save "{\"args\":[\"$CLASS_ID\",\"$TODAY\",[\"$STUDENT_ID\"]]}" "save attendance" >/tmp/smoke_attendance_response
post attendance.list "{\"args\":[\"$CLASS_ID\"]}" "list attendance"
SESSION_ID="$(sed -n 's/.*\"id\":\"\([^\"]*\)\".*/\1/p' /tmp/smoke_class_response | head -1)"
# The class response is intentionally not a session; obtain the session ID from its own response.
post sessions.start "{\"args\":[\"$CLASS_ID\",\"Smoke Session\"]}" "start session" >/tmp/smoke_session_response
SESSION_ID="$(sed -n 's/.*\"id\":\"\([^\"]*\)\".*/\1/p' /tmp/smoke_session_response | head -1)"
[[ -n "$SESSION_ID" ]]
post sessions.snapshotStudents "{\"args\":[\"$SESSION_ID\"]}" "snapshot students"
post sessions.getStudentDelta "{\"args\":[\"$SESSION_ID\",\"$STUDENT_ID\"]}" "student delta"
post sessions.end "{\"args\":[\"$SESSION_ID\",{\"correct\":1,\"wrong\":0}]}" "end session" >/tmp/smoke_end_response
post sessions.list "{\"args\":[\"$CLASS_ID\"]}" "list sessions"
post stats.summary '{"args":[]}' "summary after smoke flow"

# Cleanup created records through the public API.
post students.delete "{\"args\":[\"$STUDENT_ID\"]}" "delete smoke student"
post classes.delete "{\"args\":[\"$CLASS_ID\"]}" "delete smoke class"

printf '\nPASS: API smoke matrix completed. Results: %s\n' "$OUT"
