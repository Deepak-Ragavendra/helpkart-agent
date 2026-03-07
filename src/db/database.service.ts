import { supabase } from './supabase';
import { Customer, Order, Message, ChatMessage } from '../types';

// Get customer by email
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .single();

  if (error) return null;
  return data;
}

// Get orders for a customer
export async function getOrdersByCustomerId(customerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

// Create a new session
export async function createSession(customerId?: string): Promise<string> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ customer_id: customerId || null })
    .select('id')
    .single();

  if (error) throw new Error('Failed to create session');
  return data.id;
}

// Update session last active time
export async function touchSession(sessionId: string): Promise<void> {
  await supabase
    .from('sessions')
    .update({ last_active: new Date().toISOString() })
    .eq('id', sessionId);
}

// Save a message to DB
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  await supabase
    .from('messages')
    .insert({ session_id: sessionId, role, content });
}

// Get recent messages for a session
export async function getSessionMessages(
  sessionId: string,
  limit: number = 20
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// Update session summary
export async function updateSessionSummary(
  sessionId: string,
  summary: string
): Promise<void> {
  await supabase
    .from('sessions')
    .update({ summary })
    .eq('id', sessionId);
}