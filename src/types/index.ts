export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  product_name: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  category: string;
  embedding?: number[];
  created_at: string;
}

export interface Session {
  id: string;
  customer_id?: string;
  started_at: string;
  last_active: string;
  summary?: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WSMessage {
  type: 'chat' | 'identify' | 'ping';
  content?: string;
  email?: string;
  sessionId?: string;
}