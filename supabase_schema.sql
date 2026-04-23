-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  userId TEXT NOT NULL,
  lastRecord TEXT,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chats table
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  userId TEXT NOT NULL,
  conversationId UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suggestions JSONB,
  recipe JSONB,
  status TEXT,
  hasFiles BOOLEAN DEFAULT FALSE
);

-- Create creative_conversations table
CREATE TABLE IF NOT EXISTS public.creative_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  userId TEXT NOT NULL,
  lastRecord TEXT,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create creative_chats table
CREATE TABLE IF NOT EXISTS public.creative_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  userId TEXT NOT NULL,
  conversationId UUID REFERENCES public.creative_conversations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suggestions JSONB,
  recipe JSONB,
  status TEXT,
  hasFiles BOOLEAN DEFAULT FALSE
);

-- Create recipes table
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  authorId TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  ingredients JSONB,
  instructions JSONB,
  totalCost NUMERIC,
  recommendedPrice NUMERIC,
  theme TEXT,
  image TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorId TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC,
  unit TEXT,
  purchasePrice NUMERIC,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create food_images table
CREATE TABLE IF NOT EXISTS public.food_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  userId TEXT NOT NULL,
  url TEXT NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create health_check table (for connection checks)
CREATE TABLE IF NOT EXISTS public.health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'ok',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample health check record
INSERT INTO public.health_check (status) VALUES ('ok') ON CONFLICT DO NOTHING;
