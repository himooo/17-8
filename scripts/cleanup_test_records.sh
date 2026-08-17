#!/usr/bin/env bash
set -euo pipefail

# Limited audit cleanup only. Do not replace these IDs with broad prefix deletes.
BASE="${BASE:-http://127.0.0.1:3000}"
AUDIT_STUDENT_IDS=(
  "browser_student_audit_1786640588"
  "browser_student_audit_2_1786641779"
  "st_1786648073776_yj9qpq"
  "st_1786648106052_u910qi"
  "st_1786648140631_swn78u"
)
AUDIT_CLASS_IDS=(
  "absolute_test"
  "persist_pkg_1786637813"
  "cls_runtime_test"
  "browser_game_audit_1786640588"
  "cls_1786647928719"
)

for id in "${AUDIT_STUDENT_IDS[@]}"; do
  curl -sS --fail-with-body -X POST "$BASE/api/db/students.delete" \
    -H 'Content-Type: application/json' \
    --data '{"args":["'"$id"'"]}' || true
  printf '\n'
done

for id in "${AUDIT_CLASS_IDS[@]}"; do
  curl -sS --fail-with-body -X POST "$BASE/api/db/classes.delete" \
    -H 'Content-Type: application/json' \
    --data '{"args":["'"$id"'"]}' || true
  printf '\n'
done

# StudentActivity has no foreign-key relation in the current schema, so remove
# only activities owned by the explicitly-created audit students.
python3 "$(dirname "$0")/cleanup_orphan_audit_data.py"
