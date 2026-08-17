import sqlite3
from pathlib import Path

DB = Path('/home/ubuntu/bisalasa-full-audit/data/custom.db')
AUDIT_STUDENT_IDS = (
    'browser_student_audit_1786640588',
    'browser_student_audit_2_1786641779',
    'st_1786648073776_yj9qpq',
    'st_1786648106052_u910qi',
    'st_1786648140631_swn78u',
)
with sqlite3.connect(DB) as connection:
    placeholders = ','.join('?' for _ in AUDIT_STUDENT_IDS)
    cursor = connection.execute(
        f'DELETE FROM student_activities WHERE studentId IN ({placeholders})',
        AUDIT_STUDENT_IDS,
    )
    print(f'deleted_student_activities={cursor.rowcount}')
