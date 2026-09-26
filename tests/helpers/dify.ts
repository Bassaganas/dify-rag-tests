import { APIRequestContext, test } from '@playwright/test';

// Small wrappers around the two Dify endpoints we test.
// Docs: https://docs.dify.ai/en/api-reference/guides/chat
//       https://docs.dify.ai/en/api-reference/knowledge-bases/retrieve-chunks-from-a-knowledge-base-test-retrieval

const BASE_URL = (process.env.DIFY_BASE_URL ?? '').replace(/\/+$/, '');
const TEST_USER = 'qa-e2e'; // Dify requires a `user`; one fixed value keeps test conversations together

export type Citation = { document_name: string; content: string; score: number; position: number };

export type ChatResponse = {
  answer: string;
  message_id: string;
  conversation_id: string;
  metadata: {
    retriever_resources?: Citation[];
    usage?: { latency: number; total_tokens: number };
  };
};

export type RetrievedChunk = {
  score: number;
  segment: { content: string; document: { name: string } };
};

/** Skip the current test with a helpful message when a setting is missing from .env */
export function requireEnv(...names: string[]) {
  const missing = names.filter((n) => !process.env[n] || process.env[n]!.includes('xxxx'));
  test.skip(missing.length > 0, `Fill in ${missing.join(', ')} in your .env file (see .env.example)`);
}

/** POST with a retry when Dify answers 429 (too many requests at once) */
async function post(request: APIRequestContext, path: string, key: string, data: object) {
  for (let attempt = 1; ; attempt++) {
    const res = await request.post(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      data,
    });
    if (res.status() !== 429 || attempt === 3) return res;
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

/** Ask the chatbot one question (new conversation, blocking mode) */
export async function ask(request: APIRequestContext, query: string, key = process.env.DIFY_APP_KEY!) {
  return post(request, '/chat-messages', key, {
    inputs: {},
    query,
    response_mode: 'blocking',
    conversation_id: '',
    user: TEST_USER,
  });
}

/** Search the knowledge base directly – no LLM involved */
export async function retrieve(request: APIRequestContext, query: string) {
  // Same settings as the Exercise 2.1 retrieval benchmark, so results don't depend on UI changes
  return post(request, `/datasets/${process.env.DIFY_DATASET_ID}/retrieve`, process.env.DIFY_DATASET_KEY!, {
    query,
    retrieval_model: {
      search_method: 'hybrid_search',
      reranking_enable: false,
      reranking_mode: 'weighted_score',
      weights: {
        weight_type: 'customized',
        vector_setting: { vector_weight: 0.3, embedding_provider_name: '', embedding_model_name: '' },
        keyword_setting: { keyword_weight: 0.7 },
      },
      top_k: 10,
      score_threshold_enabled: true,
      score_threshold: 0.05,
    },
  });
}

/** Jira keys such as REST-266 mentioned in a text */
export function issueKeys(text: string): string[] {
  return [...new Set(text.match(/\b[A-Z]+-\d+\b/g) ?? [])];
}

/** Does this chunk/citation belong to the given Jira issue? Works for API- and UI-ingested documents */
export function isAbout(issue: string, name: string, content: string) {
  return name.includes(issue) || content.includes(`Jira Issue: ${issue}`);
}
