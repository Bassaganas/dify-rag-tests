# Dify RAG tests

Beginner-friendly end-to-end tests for the **Testus Patronus** Dify workshop chatbot (Exercise 3).
Follow the full walkthrough in the workshop docs: **Exercise 5 – Test your RAG end to end**.

| Level | What it checks | Tool | Needs an LLM key? |
|---|---|---|---|
| 1 – Retrieval | The knowledge base finds the right Jira issue | Playwright (API only) | No |
| 2 – Chatbot | Answers mention the right facts, cite the right document, don't invent issues, refuse off-topic questions, are fast | Playwright (API only) | No |
| 3 – LLM-as-judge (bonus) | Faithfulness to the retrieved chunks, polite refusals | promptfoo | Yes – Azure values from the portal |

## Quick start (GitHub Codespaces)

1. Click **Code → Codespaces → Create codespace on main**. Dependencies install automatically.
2. Open `.env` (created for you from `.env.example`) and fill in your values.
3. Run:

```bash
npm test                 # Levels 1 + 2
npm run report           # open the HTML report (port 9323)

npm run test:judge       # Level 3 (bonus)
npm run judge:view       # results table (port 15500)
```

Running locally instead? You need Node.js 22.22+ and then `npm ci`.

## Where things live

```
golden/jira-rest.json      the golden dataset: questions, expected facts, expected source documents
tests/1-retrieval.spec.ts  Level 1 – POST /v1/datasets/{id}/retrieve
tests/2-chatbot.spec.ts    Level 2 – POST /v1/chat-messages
tests/helpers/dify.ts      tiny API helpers
promptfooconfig.yaml       Level 3 – LLM-as-judge
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
| `429` | Too many requests at once – wait a minute and re-run |

Never commit `.env` – it contains your keys (it is already in `.gitignore`).
