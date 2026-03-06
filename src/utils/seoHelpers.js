import { supabase } from "../config/supabase.js"

export const fetchByPlan = async (table, planId) => {
  console.log("DB QUERY:", table, planId)
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export const insertMany = async (table, rows) => {
  const { error } = await supabase.from(table).insert(rows)
  if (error) throw error
}
