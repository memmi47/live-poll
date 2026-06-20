import { assertAlmostEquals, assertEquals } from './_assert.ts';
import {
  cosineSimilarity,
  findBestCluster,
  formatVector,
  isPowerOfTwo,
  parseVector,
  updateCentroid,
} from '../_shared/clustering.ts';

Deno.test('cosineSimilarity: identical vectors → 1', () => {
  assertAlmostEquals(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1, 1e-9);
});

Deno.test('cosineSimilarity: orthogonal vectors → 0', () => {
  assertAlmostEquals(cosineSimilarity([1, 0], [0, 1]), 0, 1e-9);
});

Deno.test('cosineSimilarity: opposite vectors → -1', () => {
  assertAlmostEquals(cosineSimilarity([1, 0], [-1, 0]), -1, 1e-9);
});

Deno.test('cosineSimilarity: scale-invariant', () => {
  assertAlmostEquals(cosineSimilarity([2, 4], [1, 2]), 1, 1e-9);
});

Deno.test('cosineSimilarity: zero vector → 0 (no NaN)', () => {
  assertEquals(cosineSimilarity([0, 0], [1, 1]), 0);
});

Deno.test('updateCentroid: into empty cluster (count 0) returns embedding', () => {
  const result = updateCentroid([0, 0, 0], [1, 2, 3], 0);
  assertEquals(result, [1, 2, 3]);
});

Deno.test('updateCentroid: weighted running average', () => {
  // centroid [2,2] with 3 members, add [6,6] → (3*2+6)/4 = 3
  const result = updateCentroid([2, 2], [6, 6], 3);
  assertEquals(result, [3, 3]);
});

Deno.test('updateCentroid: two-step average equals batch mean', () => {
  // mean of [0,4,8] should be 4 regardless of insertion order
  let c = [0];
  c = updateCentroid(c, [4], 1); // (1*0+4)/2 = 2
  c = updateCentroid(c, [8], 2); // (2*2+8)/3 = 4
  assertAlmostEquals(c[0], 4, 1e-9);
});

Deno.test('isPowerOfTwo: labels fire at 1,2,4,8,16,32', () => {
  const fired: number[] = [];
  for (let n = 1; n <= 33; n++) if (isPowerOfTwo(n)) fired.push(n);
  assertEquals(fired, [1, 2, 4, 8, 16, 32]);
});

Deno.test('isPowerOfTwo: 0 and negatives are false', () => {
  assertEquals(isPowerOfTwo(0), false);
  assertEquals(isPowerOfTwo(-2), false);
});

Deno.test('formatVector / parseVector round-trip', () => {
  const v = [0.1, -0.2, 0.3];
  assertEquals(formatVector(v), '[0.1,-0.2,0.3]');
  assertEquals(parseVector('[0.1,-0.2,0.3]'), v);
  assertEquals(parseVector(v), v); // already an array
});

Deno.test('findBestCluster: picks the most similar centroid', () => {
  const clusters = [
    { id: 'a', centroid: [1, 0], member_count: 5 },
    { id: 'b', centroid: [0.9, 0.1], member_count: 2 },
    { id: 'c', centroid: [0, 1], member_count: 1 },
  ];
  const best = findBestCluster(clusters, [1, 0]);
  assertEquals(best?.id, 'a');
  assertAlmostEquals(best!.similarity, 1, 1e-9);
  assertEquals(best?.member_count, 5);
});

Deno.test('findBestCluster: accepts string-encoded centroids', () => {
  const clusters = [
    { id: 'a', centroid: '[0,1]', member_count: 1 },
    { id: 'b', centroid: '[1,0]', member_count: 1 },
  ];
  const best = findBestCluster(clusters, [1, 0]);
  assertEquals(best?.id, 'b');
});

Deno.test('findBestCluster: empty list → null', () => {
  assertEquals(findBestCluster([], [1, 0]), null);
});

Deno.test('findBestCluster: skips null centroids', () => {
  const clusters = [
    { id: 'a', centroid: null, member_count: 0 },
    { id: 'b', centroid: [1, 0], member_count: 1 },
  ];
  assertEquals(findBestCluster(clusters, [1, 0])?.id, 'b');
});

Deno.test('threshold scenario: similar joins, dissimilar splits', () => {
  // Simulate the assignment decision with THRESHOLD 0.78
  const THRESHOLD = 0.78;
  const clusters = [{ id: 'x', centroid: [1, 0, 0], member_count: 1 }];

  // near-parallel vector → should join
  const near = findBestCluster(clusters, [0.95, 0.05, 0]);
  assertEquals(near!.similarity >= THRESHOLD, true);

  // orthogonal vector → should split (new cluster)
  const far = findBestCluster(clusters, [0, 1, 0]);
  assertEquals(far!.similarity >= THRESHOLD, false);
});
