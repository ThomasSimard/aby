/**
 * Local text embeddings.
 *
 * Anthropic exposes no embeddings endpoint and pi-ai is a chat abstraction, so
 * vectors come from a local ONNX model. First call downloads ~90MB into the cache
 * directory; after that it runs offline.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

export function modelCacheDir(): string {
  return (
    process.env.ABY_MODEL_CACHE ??
    join(
      process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
      "aby",
      "models",
    )
  );
}

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    env.cacheDir = modelCacheDir();
    extractorPromise = pipeline("feature-extraction", EMBED_MODEL).catch(
      (err: unknown) => {
        // Let the next call retry rather than caching a rejected promise forever.
        extractorPromise = undefined;
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `could not load the embedding model ${EMBED_MODEL} (cache: ${modelCacheDir()}). ` +
            `The first run needs network access to download it. Original error: ${msg}`,
        );
      },
    );
  }
  return extractorPromise;
}

/** Mean-pooled, L2-normalised embeddings. Order matches the input. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // The model has no useful representation for "", and an all-zero vector poisons
  // cosine similarity, so give empty strings a harmless placeholder.
  const safe = texts.map((t) => (t.trim().length > 0 ? t : "(empty)"));

  const extractor = await getExtractor();
  const output = await extractor(safe, { pooling: "mean", normalize: true });

  const flat = Array.from(output.data as ArrayLike<number>, Number);
  const out: number[][] = [];
  for (let i = 0; i < safe.length; i++) {
    out.push(flat.slice(i * EMBED_DIM, (i + 1) * EMBED_DIM));
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  if (!v) throw new Error("embedding returned no vector");
  return v;
}

/** Cosine similarity for already-normalised vectors (i.e. a dot product). */
export function cosine(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}
