# Dify RAG tests

Beginner-friendly end-to-end tests for the **Testus Patronus** Dify workshop chatbot (Exercise 3).
Follow the full walkthrough in the workshop docs: **Exercise 5 – Test your RAG end to end**.

| Level | What it checks | Tool | Needs an LLM key? |
|---|---|---|---|
| 1 – Retrieval | The knowledge base finds the right Jira issue | Playwright (API only) | No |
| 2 – Chatbot | Answers mention the right facts, cite the right document, don't invent issues, refuse off-topic questions, are fast | Playwright (API only) | No |
| 3 – LLM-as-a-judge | 3A: the judge grades answers whose verdict we know (calibration). 3B: the judge grades the chatbot's faithfulness, correctness and refusals | Playwright + a Dify judge workflow | Uses the model already configured in your Dify |
| Adversarial | 22 questions designed to break the chatbot (similar issues, counting, false premises, prompt injection…). Red = finding. See [ADVERSARIAL.md](ADVERSARIAL.md) | Playwright (+ judge) | Optional |

## Quick start (GitHub Codespaces)

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

Running locally instead? You need Node.js 20+ and then `npm ci`.

## Where things live

```
golden/jira-rest.json      the golden dataset: questions, expected facts, source documents, judge criteria
tests/1-retrieval.spec.ts  Level 1 – POST /v1/datasets/{id}/retrieve
tests/2-chatbot.spec.ts    Level 2 – POST /v1/chat-messages
tests/3-judge.spec.ts      Level 3 – POST /v1/workflows/run (the judge workflow)
tests/4-adversarial.spec.ts adversarial suite, cases in golden/adversarial.json
tests/helpers/dify.ts      tiny API helpers
```

Add a new test case by adding an entry to `golden/jira-rest.json` – no code needed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tests are **skipped** | A value in `.env` is missing or still a placeholder |
| `401 unauthorized` | Wrong key type: the chatbot needs the `app-…` key, retrieval needs the `dataset-…` key |
| `400 Workflow not published` | Click **Publish** in your Exercise 3 app |
| `404` on retrieve | `DIFY_DATASET_ID` is wrong – copy it from the knowledge base URL |
| No citations | In the app, the LLM node's **Context** must be the Knowledge Retrieval result |
| `429` or rate-limit errors | The tests already wait and retry; if it persists, wait a minute and re-run |
| `Judge workflow failed` | Check the judge is published and its Judge node has a model configured |

Never commit `.env` – it contains your keys (it is already in `.gitignore`).
