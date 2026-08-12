# Supabase + GitHub Pages — nammedi

## Live URLs

| | |
|--|--|
| Site | https://zhandreya.github.io/nammedi/ |
| Repo | https://github.com/zhandreya/nammedi |
| Supabase API | https://wkduowriurfbfsowxxel.supabase.co |

Config is already set in `supabase-config.js` (project URL + anon key).

## One-time: apply the database

1. Open [SQL Editor](https://supabase.com/dashboard/project/wkduowriurfbfsowxxel/sql)
2. Paste and run `supabase/schema.sql`
3. Confirm tables under Table Editor

## Auth URLs

**Authentication → URL Configuration**

- Site URL: `https://zhandreya.github.io/nammedi/`
- Redirect URLs:
  - `https://zhandreya.github.io/nammedi/**`
  - `http://localhost:8000/**`

Enable Email provider. For easier testing, you can turn off “Confirm email”.

## GitHub Pages

Repo **nammedi** → Settings → Pages → Source: **GitHub Actions**.

Optional secrets (already baked into `supabase-config.js`; secrets override on CI if set):

- `SUPABASE_URL` = `https://wkduowriurfbfsowxxel.supabase.co`
- `SUPABASE_ANON_KEY` = the anon JWT

## Local

```bash
python3 -m http.server 8000
```

Open http://localhost:8000
