/**
 * Pure clustering math shared by submit-response (and unit tests).
 * No I/O, no Deno globals — keep it trivially testable.
 */

/** Default similarity threshold for assigning a response to an existing cluster.
 *  Lower → fewer, coarser clusters. Tune here. */
export const SIMILARITY_THRESHOLD = 0.78;

/** Cosine similarity of two equal-length vectors. Returns 0 if either is zero. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Weighted running average: new centroid after adding `embedding` to a
 *  cluster that currently has `count` members. */
export function updateCentroid(
  centroid: number[],
  embedding: number[],
  count: number,
): number[] {
  const next = count + 1;
  return centroid.map((v, i) => (v * count + embedding[i]) / next);
}

/** True for 1, 2, 4, 8, 16, 32 … — the member counts at which we (re)label. */
export function isPowerOfTwo(n: number): boolean {
  return n >= 1 && (n & (n - 1)) === 0;
}

/** Format a number array as pgvector text: "[n1,n2,...]".
 *  PostgREST sends this through PostgreSQL's text→vector implicit cast,
 *  which is more reliable than passing a raw JSON array. */
export function formatVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

/** pgvector is returned over REST as the string "[n1,n2,...]"; accept both. */
export function parseVector(v: string | number[]): number[] {
  if (Array.isArray(v)) return v;
  return JSON.parse(v as string) as number[];
}

export interface ClusterRow {
  id: string;
  centroid: string | number[] | null;
  member_count: number;
}

export interface BestMatch {
  id: string;
  similarity: number;
  centroid: number[];
  member_count: number;
}

/** Find the most cosine-similar cluster to `embedding`. Returns null if there
 *  are no clusters with a usable centroid. */
export function findBestCluster(
  clusters: ClusterRow[],
  embedding: number[],
): BestMatch | null {
  let best: BestMatch | null = null;
  for (const cl of clusters) {
    if (!cl.centroid) continue;
    const centroid = parseVector(cl.centroid);
    const sim = cosineSimilarity(centroid, embedding);
    if (best === null || sim > best.similarity) {
      best = { id: cl.id, similarity: sim, centroid, member_count: cl.member_count };
    }
  }
  return best;
}
