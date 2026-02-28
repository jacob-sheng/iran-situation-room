import { NewsItem, LLMSettings } from '../types';

export async function fetchLatestNews(settings: LLMSettings): Promise<NewsItem[]> {
  if (!settings.endpoint || !settings.apiKey) {
    throw new Error('API Endpoint and Key are required. Please configure them in settings.');
  }

  // Fetch real-time context from public RSS to feed the LLM
  let realTimeContext = "";
  try {
    const rssUrl = encodeURIComponent('https://feeds.bbci.co.uk/news/world/middle_east/rss.xml');
    const rssRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    const rssData = await rssRes.json();
    if (rssData.status === 'ok' && rssData.items) {
      const articles = rssData.items.slice(0, 10).map((item: any) => `- ${item.title}: ${item.description} (${item.link})`).join('\n');
      realTimeContext = `\n\nHere is the latest real-time news context retrieved just now:\n${articles}\n\nPlease summarize and select the 5 most important items from this context.`;
    }
  } catch (e) {
    console.warn("Could not fetch RSS feed, relying on LLM internal knowledge.");
  }

  try {
    const response = await fetch(`${settings.endpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are a military intelligence analyst. Provide the 5 latest news items about the Middle East/Iran situation. Return ONLY a valid JSON array of objects with keys: id (string), title (string), summary (string), source (string), url (string), timestamp (string). Do not include any markdown formatting like ```json.' 
          },
          { 
            role: 'user', 
            content: `Latest news updates please.${realTimeContext}` 
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content;
    
    if (!text) return [];

    try {
      // Clean up potential markdown formatting if the LLM ignored the instruction
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        return parsed as NewsItem[];
      }
      return [];
    } catch (e) {
      console.error('Failed to parse LLM response as JSON', e, text);
      return [];
    }
  } catch (error) {
    console.error('Error fetching news from LLM:', error);
    throw error;
  }
}
