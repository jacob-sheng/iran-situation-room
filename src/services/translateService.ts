import { LLMSettings } from '../types';

type TranslateItem = { id: string; text: string };
type TranslateResult = { id: string; text: string };

function stripCodeFences(input: string) {
  return String(input || '').replace(/```json/g, '').replace(/```/g, '').trim();
}

export async function translateBatchToZh(settings: LLMSettings, items: TranslateItem[]): Promise<TranslateResult[]> {
  const endpoint = String(settings.endpoint || '').replace(/\/$/, '');
  const apiKey = String(settings.apiKey || '');
  if (!endpoint || !apiKey) return [];
  if (!Array.isArray(items) || items.length === 0) return [];

  const model = (() => {
    const preferred = typeof settings.translationModel === 'string' ? settings.translationModel.trim() : '';
    if (preferred) return preferred;
    const fallback = typeof settings.model === 'string' ? settings.model.trim() : '';
    if (fallback) return fallback;
    return 'gpt-5.1-codex-mini';
  })();

  const payload = {
    target: 'zh-CN',
    items: items.map(it => ({ id: String(it.id), text: String(it.text) })),
  };

  const system = [
    'You are a translation engine.',
    'Translate the given text into Simplified Chinese (zh-CN).',
    'Keep proper nouns, acronyms, numbers, and URLs unchanged.',
    'Do not add explanations. Do not add new information.',
    'Return ONLY valid JSON in the format: { "items": [ { "id": "...", "text": "..." } ] }.',
    'Do not wrap the JSON in markdown fences.',
  ].join('\n');

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const text = stripCodeFences(data?.choices?.[0]?.message?.content);
  if (!text) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const list = Array.isArray(parsed?.items) ? parsed.items : [];
  const allowed = new Set(items.map(i => String(i.id)));

  const out: TranslateResult[] = [];
  for (const row of list) {
    const id = typeof row?.id === 'string' ? row.id : '';
    const translated = typeof row?.text === 'string' ? row.text : '';
    if (!id || !allowed.has(id) || !translated) continue;
    out.push({ id, text: translated });
  }
  return out;
}
