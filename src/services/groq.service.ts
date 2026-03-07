import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export async function streamClaudeResponse(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  callbacks: StreamCallbacks
): Promise<void> {
  let fullText = '';

  try {
    console.log('=== Calling Groq ===');
    console.log('Messages count:', messages.length);

    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      max_tokens: 1024,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullText += token;
        callbacks.onToken(token);
      }
    }

    callbacks.onComplete(fullText);

  } catch (error) {
    console.error('=== GROQ ERROR ===');
    console.error('Error message:', (error as Error).message);
    callbacks.onError(error as Error);
  }
}