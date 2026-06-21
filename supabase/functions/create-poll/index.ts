import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

type QuestionInput = {
  title: string;
  question_type: string;
  options?: unknown[];
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const body = await req.json();
    const { title, question_type, options = [], questions } = body as {
      title?: string;
      question_type?: string;
      options?: unknown[];
      questions?: QuestionInput[];
    };

    // Normalise to a questions array — supports both legacy single-question
    // and new multi-question bodies.
    const normalizedQuestions: QuestionInput[] =
      questions && questions.length > 0
        ? questions
        : [{ title: title || '', question_type: question_type || 'choice', options }];

    const firstQ = normalizedQuestions[0];

    if (!firstQ.title || !firstQ.question_type) {
      return jsonResponse({ error: 'title and question_type are required' }, 400);
    }
    if (!normalizedQuestions.every((q) => ['choice', 'open', 'both'].includes(q.question_type))) {
      return jsonResponse({ error: "question_type must be 'choice', 'open', or 'both'" }, 400);
    }

    const supabase = getServiceClient();

    for (let attempt = 0; attempt < 10; attempt++) {
      const pin = generatePin();
      const { data, error } = await supabase
        .from('polls')
        .insert({
          pin,
          title:         firstQ.title,
          question_type: firstQ.question_type,
          options:       firstQ.options ?? [],
          questions:     normalizedQuestions,
        })
        .select()
        .single();

      if (!error) return jsonResponse({ poll: data }, 201);
      if (error.code !== '23505') throw error;
    }

    return jsonResponse({ error: 'Failed to generate a unique PIN' }, 500);
  } catch (err) {
    console.error('create-poll error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
