/**
 * Safe parsing of LLM output shared by label-cluster (and unit tests).
 */

export interface ClusterLabel {
  label: string;
  summary: string;
}

/** Strip markdown code-fence markers, then parse JSON.
 *  Returns null if the result isn't an object with string label + summary. */
export function safeParseLabel(raw: string): ClusterLabel | null {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'label' in parsed &&
      'summary' in parsed &&
      typeof (parsed as Record<string, unknown>).label === 'string' &&
      typeof (parsed as Record<string, unknown>).summary === 'string'
    ) {
      const p = parsed as Record<string, string>;
      // Return only the two contract fields, ignoring any extras the model added.
      return { label: p.label, summary: p.summary };
    }
  } catch {
    // fall through
  }
  return null;
}
