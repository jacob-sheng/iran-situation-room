import { GoogleGenAI } from '@google/genai';
import { NewsItem } from '../types';

let ai: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function fetchLatestNews(): Promise<NewsItem[]> {
  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Search for the latest news regarding the current political and military situation in Iran. Provide a list of the 5 most important recent events or news updates. For each item, provide a title, a short summary (1-2 sentences), the source name, the URL, and the approximate timestamp or date. Return the result strictly as a JSON array of objects with keys: id (string), title (string), summary (string), source (string), url (string), timestamp (string). Do not include any markdown formatting like ```json.',
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed as NewsItem[];
      }
      return [];
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON', e);
      return [];
    }
  } catch (error) {
    console.error('Error fetching news from Gemini:', error);
    return [];
  }
}
