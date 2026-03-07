import { supabase } from '../db/supabase';

export interface KnowledgeChunk {
  title: string;
  content: string;
  category: string;
}

// Retrieve relevant knowledge based on keywords in the user message
export async function retrieveRelevantKnowledge(
  userMessage: string
): Promise<KnowledgeChunk[]> {
  const lowerMessage = userMessage.toLowerCase();

  // Map keywords to categories/topics
  const keywords = extractKeywords(lowerMessage);

  if (keywords.length === 0) return [];

  // Search knowledge base using Postgres full-text search
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('title, content, category')
    .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
    .limit(3);

  if (error || !data) return [];

  return data;
}

// Extract meaningful keywords from user message
function extractKeywords(message: string): string[] {
  const keywordMap: Record<string, string[]> = {
    return: ['return', 'refund', 'send back', 'money back'],
    shipping: ['ship', 'deliver', 'delivery', 'track', 'tracking', 'when will'],
    cancel: ['cancel', 'cancellation', 'stop order'],
    payment: ['pay', 'payment', 'upi', 'card', 'emi', 'cash'],
    damaged: ['damage', 'damaged', 'broken', 'defective', 'wrong item'],
    order: ['order', 'orders', 'purchase', 'bought'],
  };

  const found: string[] = [];

  for (const [, terms] of Object.entries(keywordMap)) {
    for (const term of terms) {
      if (message.includes(term)) {
        found.push(term);
        break; // one match per category is enough
      }
    }
  }

  // Also add individual words longer than 4 chars as fallback
  if (found.length === 0) {
    const words = message.split(' ').filter(w => w.length > 4);
    found.push(...words.slice(0, 3));
  }

  return found;
}

// Format retrieved chunks into a clean context string
export function formatKnowledgeContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return '';

  const formatted = chunks
    .map(c => `[${c.title}]: ${c.content}`)
    .join('\n\n');

  return `\n\nRelevant HelpKart policies and information:\n${formatted}`;
}