/* 决战动漫之巅 · Supabase 客户端配置 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jnhetrqhizfuxwfnjcoh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaGV0cnFoaXpmdXh3Zm5qY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODIwMDIsImV4cCI6MjEwMDM1ODAwMn0.Bj4g5R4MOCdvW8gZTHRehqLzaCE5Q8huCtHO7_WWmR0';

window.SB = createClient(SUPABASE_URL, SUPABASE_KEY);
