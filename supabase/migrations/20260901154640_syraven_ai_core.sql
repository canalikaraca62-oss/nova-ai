-- ============================================================
-- SYRAVEN AI CORE
-- Enterprise AI Operating System Database Layer
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;


-- ------------------------------------------------------------
-- UPDATED_AT FUNCTION
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================
-- AI MODEL REGISTRY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider TEXT NOT NULL,
  model_key TEXT NOT NULL,
  display_name TEXT NOT NULL,

  model_type TEXT NOT NULL DEFAULT 'chat',

  context_window INTEGER,
  max_output_tokens INTEGER,

  input_cost_per_million NUMERIC(14,6) DEFAULT 0,
  output_cost_per_million NUMERIC(14,6) DEFAULT 0,

  supports_tools BOOLEAN DEFAULT FALSE,
  supports_vision BOOLEAN DEFAULT FALSE,
  supports_json BOOLEAN DEFAULT FALSE,
  supports_streaming BOOLEAN DEFAULT TRUE,

  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(provider, model_key)
);


CREATE INDEX IF NOT EXISTS idx_ai_models_provider
ON public.ai_models(provider);

CREATE INDEX IF NOT EXISTS idx_ai_models_active
ON public.ai_models(is_active);


-- ============================================================
-- AI AGENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,
  workspace_id UUID,
  project_id UUID,

  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),

  agent_type TEXT NOT NULL DEFAULT 'assistant',

  system_prompt TEXT,

  default_model_id UUID
    REFERENCES public.ai_models(id)
    ON DELETE SET NULL,

  temperature NUMERIC(4,3) DEFAULT 0.7,
  max_tokens INTEGER,

  memory_enabled BOOLEAN DEFAULT TRUE,
  knowledge_enabled BOOLEAN DEFAULT TRUE,
  tools_enabled BOOLEAN DEFAULT TRUE,

  configuration JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(owner_id, slug)
);


CREATE INDEX IF NOT EXISTS idx_ai_agents_owner
ON public.ai_agents(owner_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_status
ON public.ai_agents(status);

CREATE INDEX IF NOT EXISTS idx_ai_agents_org
ON public.ai_agents(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_workspace
ON public.ai_agents(workspace_id);


-- ============================================================
-- AGENT VERSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id UUID NOT NULL
    REFERENCES public.ai_agents(id)
    ON DELETE CASCADE,

  version INTEGER NOT NULL,

  name TEXT,
  description TEXT,

  system_prompt TEXT,

  model_id UUID
    REFERENCES public.ai_models(id)
    ON DELETE SET NULL,

  configuration JSONB DEFAULT '{}'::jsonb,

  created_by UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, version)
);


CREATE INDEX IF NOT EXISTS idx_ai_agent_versions_agent
ON public.ai_agent_versions(agent_id);


-- ============================================================
-- AI TOOLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  owner_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  name TEXT NOT NULL,
  slug TEXT NOT NULL,

  description TEXT,

  tool_type TEXT NOT NULL DEFAULT 'function'
    CHECK (
      tool_type IN (
        'function',
        'api',
        'database',
        'webhook',
        'code',
        'integration'
      )
    ),

  endpoint TEXT,

  input_schema JSONB DEFAULT '{}'::jsonb,
  output_schema JSONB DEFAULT '{}'::jsonb,

  configuration JSONB DEFAULT '{}'::jsonb,

  requires_auth BOOLEAN DEFAULT TRUE,

  is_active BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(owner_id, slug)
);


CREATE INDEX IF NOT EXISTS idx_ai_tools_owner
ON public.ai_tools(owner_id);

CREATE INDEX IF NOT EXISTS idx_ai_tools_active
ON public.ai_tools(is_active);


-- ============================================================
-- AGENT TOOL RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id UUID NOT NULL
    REFERENCES public.ai_agents(id)
    ON DELETE CASCADE,

  tool_id UUID NOT NULL
    REFERENCES public.ai_tools(id)
    ON DELETE CASCADE,

  enabled BOOLEAN DEFAULT TRUE,

  configuration JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, tool_id)
);


CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent
ON public.ai_agent_tools(agent_id);


-- ============================================================
-- AGENT PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id UUID NOT NULL
    REFERENCES public.ai_agents(id)
    ON DELETE CASCADE,

  permission TEXT NOT NULL,

  granted BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, permission)
);


CREATE INDEX IF NOT EXISTS idx_ai_agent_permissions_agent
ON public.ai_agent_permissions(agent_id);


-- ============================================================
-- AI CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,
  workspace_id UUID,
  project_id UUID,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  title TEXT,

  status TEXT DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'archived',
        'deleted'
      )
    ),

  model_id UUID
    REFERENCES public.ai_models(id)
    ON DELETE SET NULL,

  context JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  message_count INTEGER DEFAULT 0,

  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
ON public.ai_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent
ON public.ai_conversations(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_project
ON public.ai_conversations(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_created
ON public.ai_conversations(created_at DESC);


-- ============================================================
-- AI MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL
    REFERENCES public.ai_conversations(id)
    ON DELETE CASCADE,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  role TEXT NOT NULL
    CHECK (
      role IN (
        'system',
        'user',
        'assistant',
        'tool'
      )
    ),

  content TEXT,

  content_json JSONB,

  model_id UUID
    REFERENCES public.ai_models(id)
    ON DELETE SET NULL,

  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  latency_ms INTEGER,

  tool_calls JSONB DEFAULT '[]'::jsonb,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
ON public.ai_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_messages_created
ON public.ai_messages(created_at);


-- ============================================================
-- AI CONTEXT SNAPSHOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL
    REFERENCES public.ai_conversations(id)
    ON DELETE CASCADE,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  context_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  token_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_conversation
ON public.ai_context_snapshots(conversation_id);


-- ============================================================
-- LONG TERM MEMORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  conversation_id UUID
    REFERENCES public.ai_conversations(id)
    ON DELETE SET NULL,

  memory_type TEXT NOT NULL DEFAULT 'semantic'
    CHECK (
      memory_type IN (
        'semantic',
        'episodic',
        'procedural',
        'preference',
        'fact'
      )
    ),

  content TEXT NOT NULL,

  importance NUMERIC(4,3) DEFAULT 0.5,

  embedding vector(1536),

  metadata JSONB DEFAULT '{}'::jsonb,

  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_memories_user
ON public.ai_memories(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_memories_agent
ON public.ai_memories(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_memories_type
ON public.ai_memories(memory_type);

CREATE INDEX IF NOT EXISTS idx_ai_memories_created
ON public.ai_memories(created_at DESC);


-- ============================================================
-- MEMORY RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_memory_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_memory_id UUID NOT NULL
    REFERENCES public.ai_memories(id)
    ON DELETE CASCADE,

  target_memory_id UUID NOT NULL
    REFERENCES public.ai_memories(id)
    ON DELETE CASCADE,

  relation_type TEXT NOT NULL,

  strength NUMERIC(4,3) DEFAULT 1.0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(
    source_memory_id,
    target_memory_id,
    relation_type
  ),

  CHECK (
    source_memory_id <> target_memory_id
  )
);


-- ============================================================
-- KNOWLEDGE BASES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  owner_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  name TEXT NOT NULL,
  slug TEXT,

  description TEXT,

  status TEXT DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'archived'
      )
    ),

  configuration JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_knowledge_bases_owner
ON public.ai_knowledge_bases(owner_id);


-- ============================================================
-- AGENT KNOWLEDGE BASE RELATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id UUID NOT NULL
    REFERENCES public.ai_agents(id)
    ON DELETE CASCADE,

  knowledge_base_id UUID NOT NULL
    REFERENCES public.ai_knowledge_bases(id)
    ON DELETE CASCADE,

  enabled BOOLEAN DEFAULT TRUE,

  priority INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, knowledge_base_id)
);


-- ============================================================
-- KNOWLEDGE SOURCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  knowledge_base_id UUID NOT NULL
    REFERENCES public.ai_knowledge_bases(id)
    ON DELETE CASCADE,

  source_type TEXT NOT NULL
    CHECK (
      source_type IN (
        'file',
        'url',
        'database',
        'api',
        'manual',
        'integration'
      )
    ),

  name TEXT NOT NULL,

  source_url TEXT,

  external_id TEXT,

  status TEXT DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'processing',
        'ready',
        'failed'
      )
    ),

  configuration JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_base
ON public.ai_knowledge_sources(knowledge_base_id);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_status
ON public.ai_knowledge_sources(status);


-- ============================================================
-- KNOWLEDGE DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  knowledge_source_id UUID NOT NULL
    REFERENCES public.ai_knowledge_sources(id)
    ON DELETE CASCADE,

  external_id TEXT,

  title TEXT,

  content TEXT,

  content_hash TEXT,

  mime_type TEXT,

  status TEXT DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'processing',
        'indexed',
        'failed'
      )
    ),

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_knowledge_documents_source
ON public.ai_knowledge_documents(knowledge_source_id);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_documents_status
ON public.ai_knowledge_documents(status);


-- ============================================================
-- KNOWLEDGE CHUNKS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  knowledge_document_id UUID NOT NULL
    REFERENCES public.ai_knowledge_documents(id)
    ON DELETE CASCADE,

  chunk_index INTEGER NOT NULL,

  content TEXT NOT NULL,

  token_count INTEGER,

  embedding vector(1536),

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(knowledge_document_id, chunk_index)
);


CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_document
ON public.ai_knowledge_chunks(knowledge_document_id);


-- ============================================================
-- AGENT EXECUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  conversation_id UUID
    REFERENCES public.ai_conversations(id)
    ON DELETE SET NULL,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  model_id UUID
    REFERENCES public.ai_models(id)
    ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (
      status IN (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled',
        'timeout'
      )
    ),

  input JSONB DEFAULT '{}'::jsonb,

  output JSONB,

  error TEXT,

  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  estimated_cost NUMERIC(14,8) DEFAULT 0,

  latency_ms INTEGER,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_agent_executions_agent
ON public.ai_agent_executions(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_executions_user
ON public.ai_agent_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_executions_status
ON public.ai_agent_executions(status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_executions_created
ON public.ai_agent_executions(created_at DESC);


-- ============================================================
-- EXECUTION STEPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id UUID NOT NULL
    REFERENCES public.ai_agent_executions(id)
    ON DELETE CASCADE,

  step_number INTEGER NOT NULL,

  step_type TEXT NOT NULL
    CHECK (
      step_type IN (
        'reasoning',
        'model',
        'tool',
        'memory',
        'knowledge',
        'validation',
        'output'
      )
    ),

  name TEXT,

  status TEXT DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'running',
        'completed',
        'failed'
      )
    ),

  input JSONB DEFAULT '{}'::jsonb,
  output JSONB,

  error TEXT,

  latency_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(execution_id, step_number)
);


CREATE INDEX IF NOT EXISTS idx_ai_execution_steps_execution
ON public.ai_execution_steps(execution_id);


-- ============================================================
-- TOOL EXECUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id UUID
    REFERENCES public.ai_agent_executions(id)
    ON DELETE CASCADE,

  tool_id UUID
    REFERENCES public.ai_tools(id)
    ON DELETE SET NULL,

  tool_name TEXT,

  status TEXT DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'running',
        'completed',
        'failed'
      )
    ),

  input JSONB DEFAULT '{}'::jsonb,

  output JSONB,

  error TEXT,

  latency_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_execution
ON public.ai_tool_executions(execution_id);


-- ============================================================
-- MODEL USAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_model_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  execution_id UUID
    REFERENCES public.ai_agent_executions(id)
    ON DELETE SET NULL,

  model_id UUID
    REFERENCES public.ai_models(id)
    ON DELETE SET NULL,

  provider TEXT,
  model_key TEXT,

  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  estimated_cost NUMERIC(14,8) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_model_usage_user
ON public.ai_model_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_usage_agent
ON public.ai_model_usage(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_usage_model
ON public.ai_model_usage(model_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_usage_created
ON public.ai_model_usage(created_at DESC);


-- ============================================================
-- AI BUDGETS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  monthly_limit NUMERIC(14,4),

  current_month_usage NUMERIC(14,8) DEFAULT 0,

  alert_threshold NUMERIC(5,4) DEFAULT 0.8,

  currency TEXT DEFAULT 'USD',

  period_start DATE,
  period_end DATE,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_budgets_user
ON public.ai_budgets(user_id);


-- ============================================================
-- AI API KEYS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  owner_id UUID
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  provider TEXT NOT NULL,

  name TEXT NOT NULL,

  encrypted_secret TEXT NOT NULL,

  is_active BOOLEAN DEFAULT TRUE,

  last_used_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_provider_credentials_owner
ON public.ai_provider_credentials(owner_id);

CREATE INDEX IF NOT EXISTS idx_ai_provider_credentials_provider
ON public.ai_provider_credentials(provider);


-- ============================================================
-- AI EVALUATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  description TEXT,

  evaluation_type TEXT DEFAULT 'manual',

  configuration JSONB DEFAULT '{}'::jsonb,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.ai_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  evaluation_id UUID NOT NULL
    REFERENCES public.ai_evaluations(id)
    ON DELETE CASCADE,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  status TEXT DEFAULT 'queued',

  score NUMERIC(8,4),

  input JSONB DEFAULT '{}'::jsonb,
  output JSONB,

  results JSONB DEFAULT '{}'::jsonb,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- AI EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID,

  user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  agent_id UUID
    REFERENCES public.ai_agents(id)
    ON DELETE SET NULL,

  execution_id UUID
    REFERENCES public.ai_agent_executions(id)
    ON DELETE SET NULL,

  event_type TEXT NOT NULL,

  event_data JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ai_events_type
ON public.ai_events(event_type);

CREATE INDEX IF NOT EXISTS idx_ai_events_created
ON public.ai_events(created_at DESC);


-- ============================================================
-- RLS ENABLEMENT
-- ============================================================

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_context_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory_relations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_executions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_model_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_evaluation_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.ai_owns_agent(agent_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_agents
    WHERE id = agent_uuid
    AND owner_id = auth.uid()
  );
$$;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- AI MODELS
DROP POLICY IF EXISTS "Authenticated users can read AI models"
ON public.ai_models;

CREATE POLICY "Authenticated users can read AI models"
ON public.ai_models
FOR SELECT
TO authenticated
USING (is_active = TRUE);


-- AI AGENTS

DROP POLICY IF EXISTS "Users manage own AI agents"
ON public.ai_agents;

CREATE POLICY "Users manage own AI agents"
ON public.ai_agents
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());


-- AGENT VERSIONS

DROP POLICY IF EXISTS "Users manage own agent versions"
ON public.ai_agent_versions;

CREATE POLICY "Users manage own agent versions"
ON public.ai_agent_versions
FOR ALL
TO authenticated
USING (public.ai_owns_agent(agent_id))
WITH CHECK (public.ai_owns_agent(agent_id));


-- AI TOOLS

DROP POLICY IF EXISTS "Users manage own AI tools"
ON public.ai_tools;

CREATE POLICY "Users manage own AI tools"
ON public.ai_tools
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());


-- AGENT TOOLS

DROP POLICY IF EXISTS "Users manage own agent tools"
ON public.ai_agent_tools;

CREATE POLICY "Users manage own agent tools"
ON public.ai_agent_tools
FOR ALL
TO authenticated
USING (public.ai_owns_agent(agent_id))
WITH CHECK (public.ai_owns_agent(agent_id));


-- AGENT PERMISSIONS

DROP POLICY IF EXISTS "Users manage own agent permissions"
ON public.ai_agent_permissions;

CREATE POLICY "Users manage own agent permissions"
ON public.ai_agent_permissions
FOR ALL
TO authenticated
USING (public.ai_owns_agent(agent_id))
WITH CHECK (public.ai_owns_agent(agent_id));


-- CONVERSATIONS

DROP POLICY IF EXISTS "Users manage own AI conversations"
ON public.ai_conversations;

CREATE POLICY "Users manage own AI conversations"
ON public.ai_conversations
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- MESSAGES

DROP POLICY IF EXISTS "Users manage messages in own conversations"
ON public.ai_messages;

CREATE POLICY "Users manage messages in own conversations"
ON public.ai_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);


-- CONTEXT SNAPSHOTS

DROP POLICY IF EXISTS "Users manage own context snapshots"
ON public.ai_context_snapshots;

CREATE POLICY "Users manage own context snapshots"
ON public.ai_context_snapshots
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);


-- MEMORIES

DROP POLICY IF EXISTS "Users manage own AI memories"
ON public.ai_memories;

CREATE POLICY "Users manage own AI memories"
ON public.ai_memories
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- MEMORY RELATIONS

DROP POLICY IF EXISTS "Users manage own memory relations"
ON public.ai_memory_relations;

CREATE POLICY "Users manage own memory relations"
ON public.ai_memory_relations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_memories
    WHERE id = source_memory_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_memories
    WHERE id = source_memory_id
    AND user_id = auth.uid()
  )
);


-- KNOWLEDGE BASES

DROP POLICY IF EXISTS "Users manage own knowledge bases"
ON public.ai_knowledge_bases;

CREATE POLICY "Users manage own knowledge bases"
ON public.ai_knowledge_bases
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());


-- AGENT KNOWLEDGE BASES

DROP POLICY IF EXISTS "Users manage own agent knowledge"
ON public.ai_agent_knowledge_bases;

CREATE POLICY "Users manage own agent knowledge"
ON public.ai_agent_knowledge_bases
FOR ALL
TO authenticated
USING (public.ai_owns_agent(agent_id))
WITH CHECK (public.ai_owns_agent(agent_id));


-- KNOWLEDGE SOURCES

DROP POLICY IF EXISTS "Users manage own knowledge sources"
ON public.ai_knowledge_sources;

CREATE POLICY "Users manage own knowledge sources"
ON public.ai_knowledge_sources
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_knowledge_bases kb
    WHERE kb.id = knowledge_base_id
    AND kb.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_knowledge_bases kb
    WHERE kb.id = knowledge_base_id
    AND kb.owner_id = auth.uid()
  )
);


-- KNOWLEDGE DOCUMENTS

DROP POLICY IF EXISTS "Users manage own knowledge documents"
ON public.ai_knowledge_documents;

CREATE POLICY "Users manage own knowledge documents"
ON public.ai_knowledge_documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_knowledge_sources ks
    JOIN public.ai_knowledge_bases kb
      ON kb.id = ks.knowledge_base_id
    WHERE ks.id = knowledge_source_id
    AND kb.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_knowledge_sources ks
    JOIN public.ai_knowledge_bases kb
      ON kb.id = ks.knowledge_base_id
    WHERE ks.id = knowledge_source_id
    AND kb.owner_id = auth.uid()
  )
);


-- KNOWLEDGE CHUNKS

DROP POLICY IF EXISTS "Users manage own knowledge chunks"
ON public.ai_knowledge_chunks;

CREATE POLICY "Users manage own knowledge chunks"
ON public.ai_knowledge_chunks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_knowledge_documents kd
    JOIN public.ai_knowledge_sources ks
      ON ks.id = kd.knowledge_source_id
    JOIN public.ai_knowledge_bases kb
      ON kb.id = ks.knowledge_base_id
    WHERE kd.id = knowledge_document_id
    AND kb.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_knowledge_documents kd
    JOIN public.ai_knowledge_sources ks
      ON ks.id = kd.knowledge_source_id
    JOIN public.ai_knowledge_bases kb
      ON kb.id = ks.knowledge_base_id
    WHERE kd.id = knowledge_document_id
    AND kb.owner_id = auth.uid()
  )
);


-- EXECUTIONS

DROP POLICY IF EXISTS "Users read own AI executions"
ON public.ai_agent_executions;

CREATE POLICY "Users read own AI executions"
ON public.ai_agent_executions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- EXECUTION STEPS

DROP POLICY IF EXISTS "Users read own execution steps"
ON public.ai_execution_steps;

CREATE POLICY "Users read own execution steps"
ON public.ai_execution_steps
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_agent_executions e
    WHERE e.id = execution_id
    AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_agent_executions e
    WHERE e.id = execution_id
    AND e.user_id = auth.uid()
  )
);


-- TOOL EXECUTIONS

DROP POLICY IF EXISTS "Users read own tool executions"
ON public.ai_tool_executions;

CREATE POLICY "Users read own tool executions"
ON public.ai_tool_executions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_agent_executions e
    WHERE e.id = execution_id
    AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_agent_executions e
    WHERE e.id = execution_id
    AND e.user_id = auth.uid()
  )
);


-- MODEL USAGE

DROP POLICY IF EXISTS "Users read own model usage"
ON public.ai_model_usage;

CREATE POLICY "Users read own model usage"
ON public.ai_model_usage
FOR SELECT
TO authenticated
USING (user_id = auth.uid());


-- BUDGETS

DROP POLICY IF EXISTS "Users manage own AI budgets"
ON public.ai_budgets;

CREATE POLICY "Users manage own AI budgets"
ON public.ai_budgets
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- PROVIDER CREDENTIALS

DROP POLICY IF EXISTS "Users manage own AI credentials"
ON public.ai_provider_credentials;

CREATE POLICY "Users manage own AI credentials"
ON public.ai_provider_credentials
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());


-- EVALUATIONS

DROP POLICY IF EXISTS "Users manage own AI evaluations"
ON public.ai_evaluations;

CREATE POLICY "Users manage own AI evaluations"
ON public.ai_evaluations
FOR ALL
TO authenticated
USING (public.ai_owns_agent(agent_id))
WITH CHECK (public.ai_owns_agent(agent_id));


-- EVALUATION RUNS

DROP POLICY IF EXISTS "Users manage own evaluation runs"
ON public.ai_evaluation_runs;

CREATE POLICY "Users manage own evaluation runs"
ON public.ai_evaluation_runs
FOR ALL
TO authenticated
USING (public.ai_owns_agent(agent_id))
WITH CHECK (public.ai_owns_agent(agent_id));


-- EVENTS

DROP POLICY IF EXISTS "Users read own AI events"
ON public.ai_events;

CREATE POLICY "Users read own AI events"
ON public.ai_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid());


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_ai_models_updated_at ON public.ai_models;
CREATE TRIGGER trg_ai_models_updated_at
BEFORE UPDATE ON public.ai_models
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_agents_updated_at ON public.ai_agents;
CREATE TRIGGER trg_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_tools_updated_at ON public.ai_tools;
CREATE TRIGGER trg_ai_tools_updated_at
BEFORE UPDATE ON public.ai_tools
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_memories_updated_at ON public.ai_memories;
CREATE TRIGGER trg_ai_memories_updated_at
BEFORE UPDATE ON public.ai_memories
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_knowledge_bases_updated_at
ON public.ai_knowledge_bases;

CREATE TRIGGER trg_ai_knowledge_bases_updated_at
BEFORE UPDATE ON public.ai_knowledge_bases
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_knowledge_sources_updated_at
ON public.ai_knowledge_sources;

CREATE TRIGGER trg_ai_knowledge_sources_updated_at
BEFORE UPDATE ON public.ai_knowledge_sources
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_knowledge_documents_updated_at
ON public.ai_knowledge_documents;

CREATE TRIGGER trg_ai_knowledge_documents_updated_at
BEFORE UPDATE ON public.ai_knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_agent_executions_updated_at
ON public.ai_agent_executions;

CREATE TRIGGER trg_ai_agent_executions_updated_at
BEFORE UPDATE ON public.ai_agent_executions
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_budgets_updated_at
ON public.ai_budgets;

CREATE TRIGGER trg_ai_budgets_updated_at
BEFORE UPDATE ON public.ai_budgets
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_provider_credentials_updated_at
ON public.ai_provider_credentials;

CREATE TRIGGER trg_ai_provider_credentials_updated_at
BEFORE UPDATE ON public.ai_provider_credentials
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_evaluations_updated_at
ON public.ai_evaluations;

CREATE TRIGGER trg_ai_evaluations_updated_at
BEFORE UPDATE ON public.ai_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.ai_set_updated_at();


-- ============================================================
-- DEFAULT AI MODELS
-- ============================================================

INSERT INTO public.ai_models (
  provider,
  model_key,
  display_name,
  model_type,
  supports_tools,
  supports_vision,
  supports_json,
  supports_streaming,
  is_active
)
VALUES

(
  'openai',
  'gpt-4.1',
  'GPT-4.1',
  'chat',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
),

(
  'openai',
  'gpt-4.1-mini',
  'GPT-4.1 Mini',
  'chat',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
),

(
  'openai',
  'gpt-4o',
  'GPT-4o',
  'chat',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
),

(
  'anthropic',
  'claude-sonnet',
  'Claude Sonnet',
  'chat',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
),

(
  'google',
  'gemini-pro',
  'Gemini Pro',
  'chat',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
)

ON CONFLICT (provider, model_key)
DO NOTHING;


-- ============================================================
-- REALTIME
-- ============================================================

DO $$
BEGIN

  ALTER PUBLICATION supabase_realtime
  ADD TABLE public.ai_agent_executions;

EXCEPTION
WHEN duplicate_object THEN
  NULL;
END $$;


DO $$
BEGIN

  ALTER PUBLICATION supabase_realtime
  ADD TABLE public.ai_messages;

EXCEPTION
WHEN duplicate_object THEN
  NULL;
END $$;


DO $$
BEGIN

  ALTER PUBLICATION supabase_realtime
  ADD TABLE public.ai_execution_steps;

EXCEPTION
WHEN duplicate_object THEN
  NULL;
END $$;


-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.ai_agents IS
'SYRAVEN AI agent registry';

COMMENT ON TABLE public.ai_agent_executions IS
'Runtime execution records for AI agents';

COMMENT ON TABLE public.ai_memories IS
'Long-term semantic and episodic AI memory';

COMMENT ON TABLE public.ai_knowledge_bases IS
'Knowledge bases used by AI agents';

COMMENT ON TABLE public.ai_knowledge_chunks IS
'Vector-searchable document chunks';

COMMENT ON TABLE public.ai_model_usage IS
'Token and cost accounting for AI model usage';

COMMENT ON TABLE public.ai_events IS
'AI runtime event stream';


-- ============================================================
-- END OF SYRAVEN AI CORE
-- ============================================================