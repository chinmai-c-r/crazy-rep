import "server-only";
import { getAI, isRetryable } from "./gemini";

/** Gemini embeddings, truncated to 768 dimensions (matches the vector(768) column). */
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-001";
export const EMBEDDING_DIMS = 768;
const BATCH = 100;

type Task = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Unit-length vectors so cosine similarity is a plain dot product. */
const normalise = (v: number[]) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

/** Embeds texts in batches with retries. Documents and queries use different task types for better recall. */
export async function embedTexts(texts: string[], task: Task, { retries = 4, timeoutMs = 30_000 } = {}): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await getAI().models.embedContent({
          model: EMBEDDING_MODEL,
          contents: chunk,
          config: { outputDimensionality: EMBEDDING_DIMS, taskType: task, abortSignal: AbortSignal.timeout(timeoutMs) },
        });
        const vectors = res.embeddings?.map((e) => normalise(e.values ?? []));
        if (!vectors || vectors.length !== chunk.length) throw Object.assign(new Error("Embedding count mismatch"), { status: 502 });
        out.push(...vectors);
        break;
      } catch (err) {
        if (attempt >= retries || !isRetryable(err)) throw err;
        await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
      }
    }
  }
  return out;
}

/** pgvector literal: "[0.1,0.2,…]". */
export const toVector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
