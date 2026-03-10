import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "sb_publishable_brBqlS1DfDXJbm4WYpnOow_zyv5i83m"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaG5tbmRub2xoYXBhb3F0YnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzg4NTksImV4cCI6MjA4ODQxNDg1OX0.IMSp8vYiCln_iSuoT_H2qdeX_dP1WMhOOskDw20eJXw"

export const supabase = createClient(supabaseUrl, supabaseKey)
