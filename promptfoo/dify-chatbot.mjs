// A Promptfoo "provider": how Promptfoo talks to your Dify chatbot.
// It sends the question to POST /v1/chat-messages and returns the answer plus the citations,
// so the checks in checks.mjs can look at which documents were used.
// The URL and the key are read from the environment (your .env or the GitHub secrets) and are
// never written into Promptfoo's report.

const TEMPORARY = /completion_request_error|rate.?limit|quota|timeout/i;

/**
 * Explain a network error (no HTTP answer at all) without printing the URL:
 * the report and the GitHub Actions logs are public.
 */
export function explainNetworkError(err) {
  const code = err?.cause?.code ?? err?.cause?.errors?.[0]?.code ?? err?.name ?? 'unknown';
  const hints = {
    ENOTFOUND: 'the host name in DIFY_BASE_URL does not exist. Check it for typos',
    UND_ERR_CONNECT_TIMEOUT: 'nothing answered at DIFY_BASE_URL. Check that your Dify instance is running and that the URL is your current instance',
    ECONNREFUSED: 'the host refused the connection. Check the URL and that Dify is running',
    ECONNRESET: 'the connection was dropped. Try again in a minute',
    TimeoutError: 'Dify did not answer within 60 seconds. Try again, or check that Dify is running',
    ERR_INVALID_URL: 'DIFY_BASE_URL is not a valid URL. It must look like https://dify-<your-instance>.testingfantasy.com/v1',
  };
  const hint = hints[code] ?? (/CERT|SSL|TLS/i.test(code) ? 'the HTTPS certificate was rejected. Check that DIFY_BASE_URL starts with https:// and is your Dify instance' : 'check DIFY_BASE_URL and that Dify is running');
  return `Could not reach Dify (${code}): ${hint}.`;
}

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
      let res;
      try {
        res = await fetch(`${baseUrl}/chat-messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: {}, query: question, response_mode: 'blocking', conversation_id: '', user: 'qa-promptfoo' }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        // No HTTP answer at all: retry once more in case it was a blip, then explain what to check
        if (wait !== 15_000 && !['ENOTFOUND', 'ERR_INVALID_URL'].includes(err?.cause?.code)) continue;
        return { error: explainNetworkError(err) };
      }
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
