import { ChatMessage } from '../types';
import {
  createSession,
  saveMessage,
  getSessionMessages,
  touchSession,
  updateSessionSummary,
} from '../db/database.service';
import { streamClaudeResponse } from './groq.service';

// In-memory store for active sessions
const activeSessions = new Map<string, {
  sessionId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  messages: ChatMessage[];
}>();

// Max messages before we compress context
const MAX_MESSAGES = 10;

export async function getOrCreateSession(
  sessionId?: string,
  customerId?: string,
  customerName?: string,
  customerEmail?: string
): Promise<string> {
  // If session exists in memory, return it
  if (sessionId && activeSessions.has(sessionId)) {
    return sessionId;
  }

  // Create new session in DB
  const newSessionId = await createSession(customerId);

  // Load recent messages from DB if resuming
  let messages: ChatMessage[] = [];
  if (sessionId) {
    messages = await getSessionMessages(sessionId);
  }

  // Store in memory
  activeSessions.set(newSessionId, {
    sessionId: newSessionId,
    customerId,
    customerName,
    customerEmail,
    messages,
  });

  return newSessionId;
}

export function getSessionData(sessionId: string) {
  return activeSessions.get(sessionId) || null;
}

export function setCustomerOnSession(
  sessionId: string,
  customerId: string,
  customerName: string,
  customerEmail: string
) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.customerId = customerId;
    session.customerName = customerName;
    session.customerEmail = customerEmail;
  }
}

export async function addMessageToSession(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  // Add to in-memory history
  session.messages.push({ role, content });

  // Save to DB
  await saveMessage(sessionId, role, content);
  await touchSession(sessionId);

  // Compress context if too long
  if (session.messages.length > MAX_MESSAGES) {
    await compressContext(sessionId);
  }
}

// Summarize old messages to keep context short
async function compressContext(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const oldMessages = session.messages.slice(0, -6); // keep last 6
  const recentMessages = session.messages.slice(-6);

  const conversationText = oldMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  let summary = '';

  await streamClaudeResponse(
    'Summarize this support conversation briefly in 2-3 sentences. Focus on what the customer needed and what was resolved.',
    [{ role: 'user', content: conversationText }],
    {
      onToken: (token) => { summary += token; },
      onComplete: async (fullSummary: string) => {
        // Replace old messages with summary
        session.messages = [
          { role: 'assistant', content: `[Previous conversation summary: ${fullSummary}]` },
          ...recentMessages,
        ];
        await updateSessionSummary(sessionId, fullSummary);
      },
      onError: () => {
        // If compression fails, just trim old messages
        session.messages = recentMessages;
      },
    }
  );
}

export function removeSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}