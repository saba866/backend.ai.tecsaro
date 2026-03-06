import dotenv from "dotenv";
dotenv.config(); // ✅ MUST be first

import { createClient } from "@supabase/supabase-js";

console.log("SUPABASE URL:", process.env.SUPABASE_URL);


export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
