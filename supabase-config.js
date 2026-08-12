// Supabase Configuration
// ============================================================
// Replace placeholders with Project Settings → API values
// https://supabase.com/dashboard/project/_/settings/api
// ============================================================

const supabaseConfig = {
    url: 'https://wkduowriurfbfsowxxel.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHVvd3JpdXJmYmZzb3d4eGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTc5MzEsImV4cCI6MjEwMTkzMzkzMX0.9KXvTvdzP6PO-UPlMFndeaGOdLrHfj-FvjhHlmCdCiA',
    siteUrl: 'https://zhandreya.github.io/nammedi/'
};

function isSupabaseConfigValid() {
    const { url, anonKey } = supabaseConfig;
    if (!url || url.includes('YOUR_') || !url.startsWith('http')) {
        console.error('Supabase config missing or invalid: url');
        return false;
    }
    if (!anonKey || anonKey.includes('YOUR_') || anonKey.trim() === '') {
        console.error('Supabase config missing or invalid: anonKey');
        return false;
    }
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { supabaseConfig, isSupabaseConfigValid };
}

window.__SUPABASE_CONFIG__ = supabaseConfig;
window.__SUPABASE_CONFIG_VALID__ = isSupabaseConfigValid();

export { supabaseConfig, isSupabaseConfigValid };
