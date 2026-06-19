import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const body = await req.json();
    const { title, question_type, options = [] } = body as {
      title: string;
      question_type: string;
      options?: unknown[];
    };

    if (!title || !question_type) {
      return jsonResponse({ error: 'title and question_type are required' }, 400);
    }
    if (!['choice', 'open', 'both'].includes(question_type)) {
      return jsonResponse(
        { error: "question_type must be 'choice', 'open', or 'both'" },
        400,
      );
    }

    const supabase = getServiceClient();

    // Retry until a unique 6-digit PIN is successfully inserted
    for (let attempt = 0; attempt < 10; attempt++) {
      const pin = generatePin();
      const { data, error } = await supabase
        .from('polls')
        .insert({ pin, title, question_type, options })
        .select()
        .single();

      if (!error) return jsonResponse({ poll: data }, 201);

      // Only retry on duplicate-key violations
      if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
        throw error;
      }
    }

    return jsonResponse({ error: 'Failed to generate a unique PIN' }, 500);
  } catch (err) {
    console.error('create-poll error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
