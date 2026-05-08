## LingoFlow

LingoFlow is a multilingual shadowing and intensive-reading app built with Next.js, Supabase, and Gemini.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create local environment variables:

```bash
cp .env.example .env.local
```

3. Fill in the required values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy To Vercel

This project can be deployed directly to Vercel as a standard Next.js app.

1. Push the repository to GitHub.
2. Import the repo into [Vercel](https://vercel.com/new).
3. In the Vercel project settings, add these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```

4. Deploy.

## Notes

- The app now uses local/system fonts during build, so deployment does not depend on external font downloads.
