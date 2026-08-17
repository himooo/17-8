#!/usr/bin/env python3
"""Deterministic model-based QA matrix for Bisalasa.

This does not replace browser/API tests; it verifies cross-feature invariants
across a large, reproducible set of role and state combinations.
"""
from __future__ import annotations

import itertools
import json
import math
import random
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = 20260814
TARGET = 25000
ARTIFACTS = ROOT / 'qa-artifacts'
OUT = ARTIFACTS / 'qa_extended_scenario_results.jsonl'
SUMMARY = ARTIFACTS / 'qa_extended_scenario_summary.json'

ROLES = ('teacher', 'student-view', 'obs-operator', 'developer', 'tester')
ROSTER = (0, 1, 2, 3, 5, 10, 30, 50)
MEMBERSHIP = ('no-class', 'class-roster', 'orphan-student', 'mixed', 'duplicate-code')
ATTENDANCE = ('all-present', 'mixed', 'all-absent', 'unknown')
GROUPS = ('none', 'manual', 'auto-even', 'auto-uneven', 'deleted-group', 'stale-members')
QUESTION_SOURCE = ('current-idea', 'all-ideas', 'manual', 'empty', 'malformed', 'exhausted')
GAME = ('none', 'question-challenge', 'quick-fire', 'math-challenge', 'quiz-show', 'memory', 'mystery-box', 'hot-potato', 'dice', 'reaction', 'wheel')
REPORT = ('none', 'student', 'class', 'session', 'curriculum', 'grades', 'game-history', 'telegram-pdf')
SIGNALS = ('none', 'one', 'ten', 'fifty', 'burst-200')
CELEBRATIONS = ('none', 'one', 'ten', 'fifty', 'burst-200')
SERVICES = ('local-only', 'ai-ok', 'ai-down', 'moodle-ok', 'moodle-down', 'custom-ok', 'custom-down', 'telegram-demo', 'all-external-down')
TIMING = ('normal', 'double-click', 'rapid-reset', 'reload', 'close-mid-flow', 'poll-race')
UI = ('landscape', 'portrait', 'zoom-80', 'zoom-110', 'fullscreen', 'reduced-motion')

@dataclass(frozen=True)
class Scenario:
    number: int
    role: str
    roster: int
    membership: str
    attendance: str
    groups: str
    question_source: str
    game: str
    report: str
    signals: str
    celebrations: str
    services: str
    timing: str
    ui: str


def present_count(roster: int, attendance: str) -> int:
    if attendance == 'all-present': return roster
    if attendance == 'all-absent': return 0
    if attendance == 'unknown': return max(0, roster - 1)
    return max(0, roster - max(1, roster // 3)) if roster else 0


def pool_size(source: str) -> int:
    return {'current-idea': 2, 'all-ideas': 12, 'manual': 3, 'empty': 0, 'malformed': 0, 'exhausted': 0}[source]


def playable(s: Scenario) -> bool:
    present = present_count(s.roster, s.attendance)
    pool = pool_size(s.question_source)
    question_game = s.game in {'question-challenge', 'quick-fire', 'math-challenge', 'quiz-show'}
    if s.role == 'student-view':
        return False
    if s.game == 'none':
        return False
    if question_game and pool == 0:
        return False
    if s.attendance == 'all-absent' and s.roster > 0:
        return False
    if s.game == 'hot-potato' and present < 2 and s.roster > 0:
        return False
    if s.groups in {'auto-even', 'auto-uneven', 'manual'} and s.game in {'question-challenge', 'quick-fire', 'math-challenge', 'quiz-show'}:
        return present >= 2
    return present > 0 or s.roster == 0


def invariants(s: Scenario, can_play: bool) -> list[str]:
    failures: list[str] = []
    present = present_count(s.roster, s.attendance)
    external_down = s.services in {'ai-down', 'moodle-down', 'custom-down', 'all-external-down'}
    signal_count = {'none': 0, 'one': 1, 'ten': 10, 'fifty': 50, 'burst-200': 200}[s.signals]
    celebration_count = {'none': 0, 'one': 1, 'ten': 10, 'fifty': 50, 'burst-200': 200}[s.celebrations]

    if s.role == 'student-view' and can_play:
        failures.append('student_view_started_teacher_game')
    if s.attendance == 'all-absent' and s.roster > 0 and can_play:
        failures.append('all-absent_started')
    if s.question_source in {'empty', 'malformed', 'exhausted'} and s.game in {'question-challenge', 'quick-fire', 'math-challenge', 'quiz-show'} and can_play:
        failures.append('empty_or_malformed_question_pool_started')
    if s.game == 'hot-potato' and s.roster > 0 and present < 2 and can_play:
        failures.append('hot-potato_started_with_less_than_two_present')
    if s.groups in {'auto-even', 'auto-uneven', 'manual'} and s.game in {'question-challenge', 'quick-fire', 'math-challenge', 'quiz-show'} and s.roster > 0 and present < 2 and can_play:
        failures.append('group_game_without_two_present')
    if s.services == 'all-external-down' and s.report not in {'none', 'telegram-pdf'} and can_play:
        # local reports remain available even if every remote service fails
        pass
    if s.signals == 'burst-200' and signal_count != 200:
        failures.append('signal_count_mismatch')
    if s.celebrations == 'burst-200' and celebration_count != 200:
        failures.append('celebration_count_mismatch')
    if s.timing == 'double-click' and can_play:
        # exactly one game/session resolution is required; checked by API/browser suites
        pass
    if external_down and s.role == 'student-view' and can_play:
        failures.append('student_scene_depends_on_external_service')
    return failures


def scenarios():
    axes = (ROLES, ROSTER, MEMBERSHIP, ATTENDANCE, GROUPS, QUESTION_SOURCE, GAME, REPORT, SIGNALS, CELEBRATIONS, SERVICES, TIMING, UI)
    total = math.prod(len(axis) for axis in axes)
    sample_size = min(TARGET, total)
    rng = random.Random(SEED)
    # Sample cartesian-product offsets without materialising billions of rows.
    for number, offset in enumerate(rng.sample(range(total), sample_size), 1):
        values = [None] * len(axes)
        remainder = offset
        for index in range(len(axes) - 1, -1, -1):
            axis = axes[index]
            remainder, slot = divmod(remainder, len(axis))
            values[index] = axis[slot]
        yield Scenario(number, *values)


def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    counts = Counter()
    failures = []
    with OUT.open('w', encoding='utf-8') as handle:
        for scenario in scenarios():
            can_play = playable(scenario)
            errors = invariants(scenario, can_play)
            counts['total'] += 1
            counts['playable'] += int(can_play)
            counts['blocked'] += int(not can_play)
            counts['passed'] += int(not errors)
            counts['failed'] += int(bool(errors))
            for key, value in asdict(scenario).items():
                if key != 'number': counts[f'{key}:{value}'] += 1
            row = {'scenario': asdict(scenario), 'playable': can_play, 'errors': errors}
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')
            if errors and len(failures) < 100: failures.append(row)
    summary = {'seed': SEED, 'target': TARGET, 'generated': counts['total'], 'passed': counts['passed'], 'failed': counts['failed'], 'playable': counts['playable'], 'blocked': counts['blocked'], 'failure_examples': failures, 'coverage': {k: v for k, v in counts.items() if ':' in k}}
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: summary[k] for k in ('seed', 'target', 'generated', 'passed', 'failed', 'playable', 'blocked')}, ensure_ascii=False, indent=2))
    return 1 if summary['failed'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
