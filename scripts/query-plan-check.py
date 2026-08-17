import sqlite3
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/bisalasa-perf-v16-runtime.db')
conn = sqlite3.connect(path)
queries = {
    'student_activities': 'SELECT id FROM student_activities WHERE studentId = ? AND sessionId = ? ORDER BY createdAt DESC LIMIT 5000',
    'celebration_events': 'SELECT id FROM celebration_events WHERE studentId = ? AND sessionId = ? ORDER BY firedAt DESC LIMIT 5000',
    'student_notes': 'SELECT id FROM student_notes WHERE studentId = ? AND sessionId = ? ORDER BY createdAt DESC LIMIT 500',
    'teacher_interactions': 'SELECT id FROM teacher_interactions WHERE studentId = ? AND sessionId = ? ORDER BY createdAt DESC LIMIT 500',
    'idea_question_attempts': 'SELECT id FROM idea_question_attempts WHERE studentId = ? AND ideaRunId IN (?, ?) ORDER BY submittedAt DESC LIMIT 5000',
    'homework_question_results': 'SELECT id FROM homework_question_results WHERE snapshotId IN (?, ?) ORDER BY answeredAt DESC',
    'game_results_session': 'SELECT id FROM game_results WHERE sessionId = ? ORDER BY startedAt DESC LIMIT 500',
}
for name, sql in queries.items():
    rows = conn.execute('EXPLAIN QUERY PLAN ' + sql, ('student', 'session', 'run-a', 'run-b', 'snap-a', 'snap-b', 'session')[:sql.count('?')]).fetchall()
    detail = ' | '.join(row[3] for row in rows)
    print(f'{name}: {detail}')
conn.close()
