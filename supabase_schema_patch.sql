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
  userId TEXT,
  source TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
