import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiText } from '../_shared/gemini.ts';

type ChatPart = { text?: string };
type ChatMessage = { role?: string; parts?: ChatPart[] };
type ChatbotInput = {
  history?: ChatMessage[];
};

const fallbackReply = 'I can help you understand your estimate, next repair steps, and what to ask the bodyshop.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as ChatbotInput;
    const history = Array.isArray(body.history) ? body.history : [];

    const normalized = history
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        text: (msg.parts || []).map((p) => p.text || '').join(' ').trim(),
      }))
      .filter((msg) => msg.text)
      .slice(-12);

    if (!normalized.length) {
      return ok({
        role: 'assistant',
        parts: [{ text: fallbackReply }],
      });
    }

    const transcript = normalized
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n');

    try {
      const reply = await generateGeminiText(
        [
          'You are Dent-Vision AI support assistant for dent estimate users.',
          'Keep answers concise, helpful, and practical.',
          'Do not invent legal guarantees or final prices.',
          `Conversation:\n${transcript}`,
          'Reply as assistant plain text.',
        ].join('\n\n'),
        350,
      );

      return ok({
        role: 'assistant',
        parts: [{ text: reply }],
      });
    } catch (modelError) {
      console.warn('[chatbot-assistant] Gemini unavailable, using fallback', modelError);
      return ok({
        role: 'assistant',
        parts: [{ text: fallbackReply }],
      });
    }
  } catch (error) {
    console.error('[chatbot-assistant] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
