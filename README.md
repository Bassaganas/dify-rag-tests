# Dify RAG tests

Beginner-friendly end-to-end tests for the **Testus Patronus** Dify workshop chatbot (Exercise 3).
Follow the full walkthrough in the workshop docs: **Exercise 5 – Test your RAG end to end**.

| Level | What it checks | Tool | Needs an LLM key? |
|---|---|---|---|
| 1 – Retrieval | The knowledge base finds the right Jira issue | Playwright (API only) | No |
| 2 – Chatbot | Answers mention the right facts, cite the right document, don't invent issues, refuse off-topic questions, are fast | Playwright (API only) | No |
| 3 – LLM-as-a-judge | 3A: the judge grades answers whose verdict we know (calibration). 3B: the judge grades the chatbot's faithfulness, correctness and refusals | Playwright + a Dify judge workflow | Uses the model already configured in your Dify |
| Adversarial | 22 questions designed to break the chatbot (similar issues, counting, false premises, prompt injection…). Red = finding. See [ADVERSARIAL.md](ADVERSARIAL.md) | Playwright (+ judge) | Optional |
| Promptfoo (optional) | The Level 2–3 checks as a YAML test table; compares the Exercise 3 and Exercise 4 chatbots side by side | [Promptfoo](https://www.promptfoo.dev/) (+ judge) | No: grading uses the Dify judge |

## Run it from GitHub Actions (nothing to install)

Every student gets their own copy of this repository and runs the tests against **their own Dify** with a
button click. Results appear on the run page and on a dashboard that keeps **all your runs side by side**, so
you can see what changed after each tweak to your Exercise 3 chatbot.

**One-time setup (5 minutes)**

1. Sign in to GitHub, then click the green **Use this template** button (above the file list, on the right) → **Create a new repository**. Make it **public** (GitHub Pages is free for public
   repositories). Your keys stay private: they are stored as encrypted secrets, never in the code or the report.
2. In your new repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:

   | Secret | Value |
   |---|---|
   | `DIFY_BASE_URL` | `https://dify-<your-instance>.testingfantasy.com/v1` |
   | `DIFY_APP_KEY` | App API key of your Exercise 3 chatbot (`app-…`) |
   | `DIFY_DATASET_KEY` | Knowledge API key (`dataset-…`) |
   | `DIFY_DATASET_ID` | ID of your `Jira_API_*` knowledge base |
   | `DIFY_JUDGE_KEY` | Optional: API key of the Exercise 5 judge workflow (`app-…`) |

3. Go to **Actions → RAG tests → Run workflow**. Describe what you are testing (for example `baseline`),
   pick the suite and click **Run workflow**.
4. After the first run finishes: **Settings → Pages → Build and deployment → Deploy from a branch →
   `gh-pages` / `(root)` → Save**. A minute later your dashboard is live at
   `https://<your-user>.github.io/<your-repo>/`.

**Every time you change your chatbot**

Change something in Exercise 3 (model, prompt, retrieval settings, knowledge base), **publish** it in Dify, and
run the workflow again with a note describing the change. Then look at:

- the **run page** – a summary table with every test and the chatbot's answer;
- the **dashboard** – one column per run, so you see which tests turned green or red;
- the **Playwright report** of each run (linked from the dashboard) – every Given/When/Then step, the answer,
  and the judge's reasoning.

Only the regression suite decides whether the run is green or red: red tests in the adversarial suite are
findings about your chatbot, not errors.

## Run it yourself (GitHub Codespaces or your laptop)

1. Click **Code → Codespaces → Create codespace on main**. Dependencies install automatically.
2. Open `.env` (created for you from `.env.example`) and fill in your values.
3. Run:

```bash
npm test                 # all levels (Level 3 is skipped until DIFY_JUDGE_KEY is set)
npm run test:retrieval   # Level 1 only
npm run test:chatbot     # Level 2 only
npm run test:judge       # Level 3 only
npm run test:adversarial # adversarial suite (expected to have red tests – they are findings)
npm run report           # open the HTML report (port 9323)
```

Level 3 needs the judge workflow: import `ex5_judge-1.16.1.yml` (download it from the Exercise 5 page) into Dify, publish it and put its API key in `DIFY_JUDGE_KEY`.

Running locally instead? You need Node.js 22+ and then `npm ci`.

## Promptfoo: compare chatbots side by side (optional)

`promptfoo/promptfooconfig.yaml` holds the same chatbot checks as Levels 2–3, written as a
[Promptfoo](https://www.promptfoo.dev/) test table: each test is a question plus a list of checks.
Promptfoo asks every question to every chatbot and shows the answers side by side, which makes it easy to see
whether a change (a new prompt, a new model, the Exercise 4 flow) is really better.

```bash
npm run promptfoo            # your Exercise 3 chatbot (DIFY_APP_KEY)
npm run promptfoo:compare    # Exercise 3 and Exercise 4 side by side (also set DIFY_APP_KEY_EX4)
npm run promptfoo:view       # open the results in your browser
```

From GitHub Actions: **Actions → Promptfoo → Run workflow** (tick **compare** and add the `DIFY_APP_KEY_EX4`
secret to include Exercise 4). The run page shows a summary table, and the full report is published to your
GitHub Pages site under `/promptfoo/run-<number>/`, next to the dashboard.

- Promptfoo runs through `npx` on demand, so `npm ci` stays as fast as before if you don't use it.
- `promptfoo/dify-chatbot.mjs` calls your chatbot and reads the URL and keys from the environment, so they never
  appear in the report.
- `promptfoo/checks.mjs` holds the citation checks and calls the same Dify judge as Level 3, with the criteria from
  `golden/jira-rest.json`. Without `DIFY_JUDGE_KEY`, the judge checks are skipped.

## Where things live

```
golden/jira-rest.json      the golden dataset: questions, expected facts, source documents, judge criteria
tests/1-retrieval.spec.ts  Level 1 – POST /v1/datasets/{id}/retrieve
tests/2-chatbot.spec.ts    Level 2 – POST /v1/chat-messages
tests/3-judge.spec.ts      Level 3 – POST /v1/workflows/run (the judge workflow)
tests/4-adversarial.spec.ts adversarial suite, cases in golden/adversarial.json
tests/helpers/dify.ts      tiny API helpers
promptfoo/                 the optional Promptfoo suite: config, Dify provider, checks, run summary
```

Add a new test case by adding an entry to `golden/jira-rest.json` – no code needed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tests are **skipped** | A value in `.env` is missing or still a placeholder |
| `401` *Authorization header must be provided* | `DIFY_BASE_URL` starts with `http://`: use `https://` (the redirect drops the key) |
| `401 unauthorized` | Wrong key type: the chatbot needs the `app-…` key, retrieval needs the `dataset-…` key |
| `400 Workflow not published` | Click **Publish** in your Exercise 3 app |
| `404` on retrieve | `DIFY_DATASET_ID` is wrong – copy it from the knowledge base URL |
| No citations | In the app, the LLM node's **Context** must be the Knowledge Retrieval result |
| `429` or rate-limit errors | The tests already wait and retry; if it persists, wait a minute and re-run |
| `Judge workflow failed` | Check the judge is published and its Judge node has a model configured |

Never commit `.env` – it contains your keys (it is already in `.gitignore`).
