const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

type GeminiImagePart = {
  base64: string;
  mimeType?: string;
};

const extractJson = (text: string): any => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not include valid JSON object');
  }

  return JSON.parse(raw.slice(start, end + 1));
};

export const ensureGeminiConfigured = () => {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase Edge Function secrets');
  }
};

const callGemini = async (parts: Array<Record<string, unknown>>, maxOutputTokens = 1400) => {
  ensureGeminiConfigured();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || '')
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return text;
};

export const generateGeminiJson = async <T>(
  instruction: string,
  images: GeminiImagePart[],
): Promise<T> => {
  const parts: Array<Record<string, unknown>> = [{ text: instruction }];

  for (const image of images) {
    if (!image.base64) continue;
    parts.push({
      inlineData: {
        mimeType: image.mimeType || 'image/jpeg',
        data: image.base64,
      },
    });
  }

  const text = await callGemini(parts, 1400);

  return extractJson(text) as T;
};

export const generateGeminiText = async (
  instruction: string,
  maxOutputTokens = 500,
): Promise<string> => {
  const parts: Array<Record<string, unknown>> = [{ text: instruction }];
  return callGemini(parts, maxOutputTokens);
};
