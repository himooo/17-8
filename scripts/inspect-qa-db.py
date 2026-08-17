import sqlite3, json
from pathlib import Path
DB = Path('/tmp/bisalasa-qa-integrations.db')
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
out = {'tables': tables, 'rows': {}}
for table in tables:
    try:
        rows = [dict(r) for r in con.execute(f'SELECT * FROM "{table}"').fetchall()]
        out['rows'][table] = rows
    except Exception as e:
        out['rows'][table] = {'error': str(e)}
print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
