// Custom checks for Promptfoo. Each one receives the chatbot's answer (`output`) and the test
// (`context.vars`), and returns { pass, score, reason }. Promptfoo shows the reason in its table.
import { readFileSync } from 'node:fs';
import { explainNetworkError } from './dify-chatbot.mjs';

const golden = JSON.parse(readFileSync(new URL('../golden/jira-rest.json', import.meta.url), 'utf8'));
const citationsOf = (context) => context.providerResponse?.metadata?.citations ?? [];
const isAbout = (issue, c) => c.document.includes(issue) || c.content.includes(`Jira Issue: ${issue}`);
const issueKeys = (text) => [...new Set(text.match(/\b(?:REST|WEBHOOKS|VOTE|TOC|QUID)-\d+\b/g) ?? [])];
const result = (pass, reason) => ({ pass, score: pass ? 1 : 0, reason });

/** The answer is grounded: a document about vars.issue is among the citations */
export function citesIssue(output, context) {
  const cited = citationsOf(context).map((c) => c.document);
  const ok = citationsOf(context).some((c) => isAbout(context.vars.issue, c));
  return result(ok, `Cited: ${cited.join(', ') || 'nothing'}`);
}

/** Refusals must not cite anything */
export function citesNothing(output, context) {
  const cited = citationsOf(context).map((c) => c.document);
  return result(cited.length === 0, cited.length ? `Cited: ${cited.join(', ')}` : 'No citations');
}

/** Every Jira key in the answer appears in a cited document (vars.ignore lists keys taken from the question) */
export function noInventedIssues(output, context) {
  const retrieved = citationsOf(context).map((c) => `${c.document}\n${c.content}`).join('\n');
  const ignore = context.vars.ignore ?? [];
  const invented = issueKeys(output).filter((k) => !retrieved.includes(k) && !ignore.includes(k));
  return result(invented.length === 0, invented.length ? `Not in any cited document: ${invented.join(', ')}` : 'Every issue key is supported by a citation');
}

/**
 * Ask the Exercise 5 judge (a Dify workflow) to grade one criterion.
 * The criteria are the same ones the Playwright judge tests use (golden/jira-rest.json).
 */
async function judge(criterion, output, context) {
  const key = process.env.DIFY_JUDGE_KEY;
  if (!key) return result(true, 'Judge skipped: add DIFY_JUDGE_KEY to grade this');
  let res;
  try {
    res = await fetch(`${process.env.DIFY_BASE_URL.replace(/\/+$/, '')}/workflows/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: {
          criterion: golden.judge.criteria[criterion],
          question: context.vars.question,
          answer: output,
          context: citationsOf(context).map((c) => c.content).join('\n\n---\n\n'),
          reference: context.vars.reference ?? '',
        },
        response_mode: 'blocking',
        user: 'qa-promptfoo',
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return result(false, `Judge (${criterion}): ${explainNetworkError(err)}`);
  }
  const body = await res.json().catch(() => ({}));
  const raw = body.data?.outputs?.result ?? '';
  try {
    const verdict = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '');
    return result(String(verdict.verdict).toUpperCase() === 'PASS', `Judge (${criterion}): ${verdict.reasoning}`);
  } catch {
    return result(false, `Judge (${criterion}) gave no readable verdict: ${raw.slice(0, 200) || JSON.stringify(body).slice(0, 200)}`);
  }
}

export const faithful = (output, context) => judge('faithfulness', output, context);
export const correct = (output, context) => judge('correctness', output, context);
export const refuses = (output, context) => judge('refusal', output, context);

/** The answer politely says it can't find the information (same pattern as the Playwright tests) */
export function saysCannotFind(output) {
  const ok = new RegExp(golden.refusalPattern, 'i').test(output);
  return result(ok, ok ? 'Says it cannot find it' : 'No refusal phrase such as "sorry" or "can\'t find"');
}
