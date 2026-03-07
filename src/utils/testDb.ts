import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { supabase } from '../db/supabase';

async function test() {
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'Missing');

  // Direct raw query to see exact error
  const { data, error } = await supabase
    .from('customers')
    .select('*');

  if (error) {
    console.log('Supabase error:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('Connected! Rows found:', data.length);
    console.log('Data:', data);
  }
}

test();