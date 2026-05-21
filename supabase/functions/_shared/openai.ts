const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

type OpenAIImagePart = {
  base64: string;
  mimeType?: string;
};

const extractJson = (text: string): any => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('OpenAI response did not include valid JSON object');
  }
  return JSON.parse(raw.slice(start, end + 1));
};

export const isOpenAIConfigured = (): boolean => !!OPENAI_API_KEY;

export const generateOpenAIVisionJson = async <T>(
  instruction: string,
  images: OpenAIImagePart[],
  maxTokens = 1400,
): Promise<T> => {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured in Supabase Edge Function secrets');
  }

  const content: any[] = [{ type: 'text', text: instruction }];

  for (const image of images) {
    if (!image.base64) continue;
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`,
        detail: 'high',
      },
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content }],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('OpenAI returned empty response');
  }

  return extractJson(text) as T;
};
