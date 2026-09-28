// A Promptfoo "provider": how Promptfoo talks to your Dify chatbot.
// It sends the question to POST /v1/chat-messages and returns the answer plus the citations,
// so the checks in checks.mjs can look at which documents were used.
// The URL and the key are read from the environment (your .env or the GitHub secrets) and are
// never written into Promptfoo's report.

const TEMPORARY = /completion_request_error|rate.?limit|quota|timeout/i;

export default class DifyChatbot {
  constructor(options) {
    this.keyEnv = options.config?.keyEnv ?? 'DIFY_APP_KEY';
    this.label = options.label;
  }

  id() {
    return `dify:${this.keyEnv}`;
  }

  async callApi(question) {
    const baseUrl = (process.env.DIFY_BASE_URL ?? '').replace(/\/+$/, '');
    const key = process.env[this.keyEnv];
    if (!baseUrl || !key) return { error: `Set DIFY_BASE_URL and ${this.keyEnv} in your .env file` };

    // Retry on rate limits and server hiccups: they say nothing about answer quality
    for (const wait of [0, 5_000, 15_000]) {
      await new Promise((r) => setTimeout(r, wait));
      const res = await fetch(`${baseUrl}/chat-messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: {}, query: question, response_mode: 'blocking', conversation_id: '', user: 'qa-promptfoo' }),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      const temporary = res.status === 429 || res.status >= 500 || (res.status === 400 && TEMPORARY.test(text));
      if (temporary && wait !== 15_000) continue;
      if (res.status !== 200) return { error: `Dify returned HTTP ${res.status}: ${text.slice(0, 300)}` };

      const body = JSON.parse(text);
      const usage = body.metadata?.usage ?? {};
      return {
        output: body.answer,
        tokenUsage: { total: usage.total_tokens, prompt: usage.prompt_tokens, completion: usage.completion_tokens },
        metadata: {
          citations: (body.metadata?.retriever_resources ?? []).map((c) => ({ document: c.document_name, content: c.content })),
        },
      };
    }
  }
}
