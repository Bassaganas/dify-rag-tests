// Turns Promptfoo's results file into the Markdown table shown on the GitHub Actions run page.
//   node promptfoo/summary.mjs promptfoo-results.json "<note>" "<report url>"
import { readFileSync } from 'node:fs';

const [file, note = '', reportUrl = ''] = process.argv.slice(2);
const { results } = JSON.parse(readFileSync(file, 'utf8'));
const rows = results.results;
const chatbots = [...new Set(rows.map((r) => r.provider.label))];
const tests = [...new Set(rows.map((r) => r.testCase.description))];
const cell = (test, bot) => {
  const runs = rows.filter((r) => r.testCase.description === test && r.provider.label === bot);
  if (!runs.length) return '–';
  const passed = runs.filter((r) => r.success).length;
  const icon = passed === runs.length ? '✅' : passed === 0 ? '❌' : '⚠️';
  return runs.length > 1 ? `${icon} ${passed}/${runs.length}` : icon;
};
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

const out = [`## Promptfoo – ${esc(note) || 'run'}`, ''];
out.push(`| Test | ${chatbots.join(' | ')} |`, `|---|${chatbots.map(() => '---').join('|')}|`);
for (const t of tests) out.push(`| ${esc(t)} | ${chatbots.map((b) => cell(t, b)).join(' | ')} |`);

const failures = rows.filter((r) => !r.success);
if (failures.length) {
  out.push('', '### Why it failed', '', '| Chatbot | Test | Failed checks | Answer |', '|---|---|---|---|');
  for (const r of failures) {
    const reasons = (r.gradingResult?.componentResults ?? []).filter((c) => !c.pass).map((c) => esc(c.reason).slice(0, 160));
    out.push(`| ${esc(r.provider.label)} | ${esc(r.testCase.description)} | ${reasons.join('<br>') || esc(r.error).slice(0, 160)} | ${esc(r.response?.output).slice(0, 200)} |`);
  }
}
const s = results.stats;
out.push('', `**${s.successes} passed, ${s.failures} failed, ${s.errors} errors.**`);
if (reportUrl) out.push('', `Full report with every answer: ${reportUrl}`);
console.log(out.join('\n'));
