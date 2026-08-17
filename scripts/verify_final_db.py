import sqlite3
from pathlib import Path

DB = Path('/home/ubuntu/bisalasa-full-audit/data/custom.db')
needle_ids = (
    'browser_game_audit_1786640588',
    'browser_student_audit_1786640588',
    'browser_student_audit_2_1786641779',
    'smoke_class_1786642903',
    'smoke_student_1786642903',
)
with sqlite3.connect(DB) as connection:
    tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    matches = []
    for table in tables:
        columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
        for column in columns:
            for needle in needle_ids:
                count = connection.execute(
                    f'SELECT COUNT(*) FROM "{table}" WHERE CAST("{column}" AS TEXT) = ?',
                    (needle,),
                ).fetchone()[0]
                if count:
                    matches.append((table, column, needle, count))
    class_count = connection.execute('SELECT COUNT(*) FROM classes').fetchone()[0]
    student_count = connection.execute('SELECT COUNT(*) FROM students').fetchone()[0]
print(f'class_count={class_count}')
print(f'student_count={student_count}')
print(f'test_id_matches={matches}')
if matches:
    raise SystemExit(1)
