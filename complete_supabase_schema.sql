-- Drop tables to safely recreate if needed (optional, uncomment if starting over)
-- DROP TABLE IF EXISTS public.users, public.creation_history, public.chats, public.conversations, public.creative_chats, public.creative_conversations, public.recipes, public.inventory, public.food_images, public.health_check CASCADE;

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uid TEXT,
  email TEXT,
  "displayName" TEXT,
  "photoURL" TEXT,
  role TEXT,
  preferences JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe JSONB,
  "userId" TEXT,
  source TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastRecord" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suggestions JSONB,
  recipe JSONB,
  status TEXT,
  "hasFiles" BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.creative_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastRecord" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creative_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" UUID REFERENCES public.creative_conversations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suggestions JSONB,
  recipe JSONB,
  status TEXT,
  "hasFiles" BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  ingredients JSONB,
  instructions JSONB,
  "totalCost" NUMERIC,
  "recommendedPrice" NUMERIC,
  theme TEXT,
  image TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id TEXT PRIMARY KEY,
  "authorId" TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC,
  unit TEXT,
  "purchasePrice" NUMERIC,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.food_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  "userId" TEXT NOT NULL,
  url TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'ok',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample health check record safely
INSERT INTO public.health_check (id, status) 
VALUES (gen_random_uuid(), 'ok') 
ON CONFLICT DO NOTHING;
