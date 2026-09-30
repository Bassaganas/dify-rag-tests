// Sends a compact digest of the test results (and the previous run) to the "Exercise 5: Test Advisor"
// Dify workflow and prints its Markdown recommendations.
//   node scripts/advise.mjs results.json [previous-history.json] [change note] > advice.md
// Needs DIFY_BASE_URL and DIFY_ADVISOR_KEY. Without DIFY_ADVISOR_KEY it prints nothing.
import { existsSync, readFileSync } from 'node:fs';
import { readResults } from './results.mjs';

const [file = 'results.json', historyFile = '', note = ''] = process.argv.slice(2);
const BASE_URL = process.env.DIFY_BASE_URL ?? '';
const KEY = process.env.DIFY_ADVISOR_KEY;
const DRY_RUN = process.env.ADVISOR_DRY_RUN === '1'; // print what would be sent, without calling Dify
if (!KEY && !DRY_RUN) process.exit(0);

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// 1. This run: totals, then every test that did not always pass (with evidence), then the ones that did
const { totals, rows } = readResults(file);
const lines = [
  `Tests: ${totals.tests}. Always passed: ${totals.allPassed}. Sometimes failed: ${totals.someFailed}. ` +
    `Always failed: ${totals.allFailed}. Skipped: ${totals.skipped}. Executions passed: ${totals.runsPassed}/${totals.runsTotal}.`,
  '',
  'NOT ALWAYS PASSING:',
];
for (const r of rows.filter((r) => r.failed > 0)) {
  lines.push(
    `- [${r.suite}] ${r.title} — passed ${r.passed}/${r.passed + r.failed}` +
      (r.why ? `\n  why it is hard: ${clip(r.why, 220)}` : '') +
      (r.truth ? `\n  correct answer: ${clip(r.truth, 160)}` : '') +
      `\n  failure: ${clip(r.error, 200)}` +
      `\n  chatbot answer: ${clip(r.failedAnswer || r.answer, 400)}`,
  );
}
if (!rows.some((r) => r.failed > 0)) lines.push('- none');
lines.push('', 'ALWAYS PASSING:');
for (const suite of [...new Set(rows.map((r) => r.suite))]) {
  const ok = rows.filter((r) => r.suite === suite && r.failed === 0 && r.passed > 0).map((r) => clip(r.title, 70));
  if (ok.length) lines.push(`- ${suite}: ${ok.join(' | ')}`);
}
const skipped = rows.filter((r) => r.passed + r.failed === 0);
if (skipped.length) lines.push('', `SKIPPED (not configured): ${skipped.map((r) => clip(r.title, 50)).join(' | ')}`);

// 2. Previous run: per-test pass counts, so the advisor can say what improved or regressed
let previous = '';
if (historyFile && existsSync(historyFile)) {
  const last = JSON.parse(readFileSync(historyFile, 'utf8')).at(-1);
  if (last) {
    previous =
      `Run #${last.run}, change note: "${last.note}". Executions passed: ${last.totals.runsPassed}/${last.totals.runsTotal}.\n` +
      Object.values(last.tests)
        .map((t) => `- [${t.suite}] ${clip(t.title, 70)}: ${t.passed}/${t.passed + t.failed}`)
        .join('\n');
  }
}

if (DRY_RUN) {
  console.log(`CHANGE NOTE: ${note}\n\nPREVIOUS RUN:\n${previous}\n\nRESULTS:\n${lines.join('\n')}`);
  process.exit(0);
}

// 3. Ask the advisor (a Dify workflow on the student's own instance)
const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/workflows/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputs: { results: lines.join('\n').slice(0, 95_000), previous_run: previous.slice(0, 19_000), change_note: note.slice(0, 900) },
    response_mode: 'blocking',
    user: 'qa-e2e-advisor',
  }),
  signal: AbortSignal.timeout(180_000),
});
const body = await res.json().catch(() => ({}));
const advice = body?.data?.outputs?.result;
if (!res.ok || body?.data?.status !== 'succeeded' || !advice) {
  console.error(`Advisor failed (HTTP ${res.status}): ${clip(JSON.stringify(body), 300)}`);
  process.exit(1);
}
console.log(advice.trim());
