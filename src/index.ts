import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

import { WSMessage } from './types';
import {
  getOrCreateSession,
  addMessageToSession,
  getSessionData,
  setCustomerOnSession,
  removeSession,
} from './services/session.service';
import { streamClaudeResponse } from './services/groq.service';
import { getCustomerByEmail, getOrdersByCustomerId } from './db/database.service';
import { retrieveRelevantKnowledge, formatKnowledgeContext } from './services/rag.service';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../public')));

// Build system prompt based on customer context
function buildSystemPrompt(
  customerName?: string,
  orders?: { product_name: string; status: string; amount: number }[],
  knowledgeContext?: string
): string {
  let prompt = `You are a friendly and efficient customer support agent for HelpKart, an Indian e-commerce platform. 
Your name is Kart. Keep responses concise and helpful — this is a live chat, not email.
Never repeat information you already gave. Be warm but get to the point quickly.
If you don't know something, say so honestly — never make up information.`;

  if (customerName) {
    prompt += `\n\nYou are speaking with ${customerName}.`;
  }

  if (orders && orders.length > 0) {
    prompt += `\n\nCustomer's recent orders:\n`;
    orders.forEach(o => {
      prompt += `- ${o.product_name} | Status: ${o.status} | Amount: ₹${o.amount}\n`;
    });
  }

  if (knowledgeContext) {
    prompt += knowledgeContext;
  }

  return prompt;
}

// Handle each WebSocket connection
wss.on('connection', async (ws: WebSocket) => {
  console.log('🔌 New client connected');

  // Create a session for this connection
  const sessionId = await getOrCreateSession();
  console.log('📝 Session created:', sessionId);

  // Send session ID to client
  ws.send(JSON.stringify({
    type: 'session',
    sessionId,
    message: 'Connected to HelpKart Support. How can I help you today?',
  }));

  ws.on('message', async (raw) => {
    let parsed: WSMessage;

    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    // Handle ping (keep-alive)
    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    // Handle customer identification
    if (parsed.type === 'identify' && parsed.email) {
      const customer = await getCustomerByEmail(parsed.email);
      if (customer) {
        setCustomerOnSession(sessionId, customer.id, customer.name, customer.email);
        ws.send(JSON.stringify({
          type: 'identified',
          message: `Welcome back, ${customer.name}! I can see your account.`,
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'identified',
          message: `I couldn't find an account with that email. You can still ask general questions.`,
        }));
      }
      return;
    }

    // Handle chat message
    if (parsed.type === 'chat' && parsed.content) {
      const userMessage = parsed.content.trim();
      if (!userMessage) return;

      // Save user message
      await addMessageToSession(sessionId, 'user', userMessage);

      // Get session data for context
      const session = getSessionData(sessionId);
      let orders;

      if (session?.customerId) {
        orders = await getOrdersByCustomerId(session.customerId);
      }

      // RAG: retrieve relevant knowledge in parallel with other prep
      const [ragChunks] = await Promise.all([
      retrieveRelevantKnowledge(userMessage),
      ]);

      const knowledgeContext = formatKnowledgeContext(ragChunks);
      const systemPrompt = buildSystemPrompt(
        session?.customerName,
        orders,
        knowledgeContext
      );
      const messages = session?.messages || [];

      // Tell client we're starting to stream
      ws.send(JSON.stringify({ type: 'stream_start' }));

      let fullResponse = '';

      // Stream Claude response token by token
      await streamClaudeResponse(systemPrompt, messages, {
        onToken: (token) => {
          fullResponse += token;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'token', content: token }));
          }
        },
        onComplete: async (fullText) => {
          // Save assistant response
          await addMessageToSession(sessionId, 'assistant', fullText);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stream_end' }));
          }
        },
        onError: (error: Error) => {
          console.error('Error:', error.message);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Sorry, something went wrong. Please try again.',
            }));
          }
        },
      });
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected, session:', sessionId);
    removeSession(sessionId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HelpKart server running on http://localhost:${PORT}`);
});