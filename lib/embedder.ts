const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = "nomic-embed-text";
const MAX_RETRY = 3;
const TIMEOUT_MS = 30_000;

export async function embed(text: string): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Ollama responded ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      return data.embedding;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRY) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Ollama embedding 失败（已重试 ${MAX_RETRY} 次）: ${lastError?.message}`);
}
