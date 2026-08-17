import json
from collections import Counter
from pathlib import Path

summary = json.loads(Path('/home/ubuntu/bisalasa-full-audit/qa_extended_scenario_summary.json').read_text(encoding='utf-8'))
failures = summary.get('failure_examples', [])
by_error = Counter(error for row in failures for error in row.get('errors', []))
by_combo = Counter((row['scenario']['membership'], row['scenario']['role'], row['scenario']['game'], row['scenario']['report']) for row in failures)
print(json.dumps({'failure_examples': len(failures), 'by_error': by_error, 'top_combinations': by_combo.most_common(20), 'examples': failures[:8]}, ensure_ascii=False, indent=2))
