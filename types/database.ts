export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_approvals: {
        Row: {
          agent_id: string
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          effect: string
          execution_key: string
          expires_at: string
          id: string
          organization_id: string | null
          project_id: string | null
          requested_for_user_id: string
          risk: string
          status: string
          tool_id: string
          workspace_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          effect: string
          execution_key: string
          expires_at: string
          id?: string
          organization_id?: string | null
          project_id?: string | null
          requested_for_user_id: string
          risk: string
          status?: string
          tool_id: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          effect?: string
          execution_key?: string
          expires_at?: string
          id?: string
          organization_id?: string | null
          project_id?: string | null
          requested_for_user_id?: string
          risk?: string
          status?: string
          tool_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          metadata: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          metadata?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          conversation_id: string | null
          cost: number | null
          created_at: string
          error: string | null
          id: string
          input_tokens: number | null
          metadata: Json
          model: string | null
          output_tokens: number | null
          started_at: string | null
          status: string
          task_id: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          conversation_id?: string | null
          cost?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          started_at?: string | null
          status?: string
          task_id?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          conversation_id?: string | null
          cost?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          started_at?: string | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          error: string | null
          id: string
          input: Json
          output: Json | null
          priority: number
          started_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          error?: string | null
          id?: string
          input?: Json
          output?: Json | null
          priority?: number
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          error?: string | null
          id?: string
          input?: Json
          output?: Json | null
          priority?: number
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          configuration: Json
          created_at: string
          description: string | null
          id: string
          model: string | null
          name: string
          status: string
          system_prompt: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          configuration?: Json
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          name: string
          status?: string
          system_prompt?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          configuration?: Json
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          name?: string
          status?: string
          system_prompt?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      ai_agent_executions: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string | null
          error: string | null
          estimated_cost: number | null
          id: string
          input: Json | null
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          model_id: string | null
          organization_id: string | null
          output: Json | null
          output_tokens: number | null
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          estimated_cost?: number | null
          id?: string
          input?: Json | null
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_id?: string | null
          organization_id?: string | null
          output?: Json | null
          output_tokens?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          estimated_cost?: number | null
          id?: string
          input?: Json | null
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_id?: string | null
          organization_id?: string | null
          output?: Json | null
          output_tokens?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_executions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_knowledge_bases: {
        Row: {
          agent_id: string
          created_at: string | null
          enabled: boolean | null
          id: string
          knowledge_base_id: string
          priority: number | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          knowledge_base_id: string
          priority?: number | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          knowledge_base_id?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_bases_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_knowledge_bases_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_permissions: {
        Row: {
          agent_id: string
          created_at: string | null
          granted: boolean | null
          id: string
          permission: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_tools: {
        Row: {
          agent_id: string
          configuration: Json | null
          created_at: string | null
          enabled: boolean | null
          id: string
          tool_id: string
        }
        Insert: {
          agent_id: string
          configuration?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          tool_id: string
        }
        Update: {
          agent_id?: string
          configuration?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_versions: {
        Row: {
          agent_id: string
          configuration: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          model_id: string | null
          name: string | null
          system_prompt: string | null
          version: number
        }
        Insert: {
          agent_id: string
          configuration?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          model_id?: string | null
          name?: string | null
          system_prompt?: string | null
          version: number
        }
        Update: {
          agent_id?: string
          configuration?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          model_id?: string | null
          name?: string | null
          system_prompt?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_versions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_type: string
          configuration: Json | null
          created_at: string | null
          default_model_id: string | null
          description: string | null
          id: string
          knowledge_enabled: boolean | null
          max_tokens: number | null
          memory_enabled: boolean | null
          metadata: Json | null
          name: string
          organization_id: string | null
          owner_id: string | null
          project_id: string | null
          slug: string
          status: string
          system_prompt: string | null
          temperature: number | null
          tools_enabled: boolean | null
          updated_at: string | null
          version: number | null
          workspace_id: string | null
        }
        Insert: {
          agent_type?: string
          configuration?: Json | null
          created_at?: string | null
          default_model_id?: string | null
          description?: string | null
          id?: string
          knowledge_enabled?: boolean | null
          max_tokens?: number | null
          memory_enabled?: boolean | null
          metadata?: Json | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          project_id?: string | null
          slug: string
          status?: string
          system_prompt?: string | null
          temperature?: number | null
          tools_enabled?: boolean | null
          updated_at?: string | null
          version?: number | null
          workspace_id?: string | null
        }
        Update: {
          agent_type?: string
          configuration?: Json | null
          created_at?: string | null
          default_model_id?: string | null
          description?: string | null
          id?: string
          knowledge_enabled?: boolean | null
          max_tokens?: number | null
          memory_enabled?: boolean | null
          metadata?: Json | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          project_id?: string | null
          slug?: string
          status?: string
          system_prompt?: string | null
          temperature?: number | null
          tools_enabled?: boolean | null
          updated_at?: string | null
          version?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_default_model_id_fkey"
            columns: ["default_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_budgets: {
        Row: {
          alert_threshold: number | null
          created_at: string | null
          currency: string | null
          current_month_usage: number | null
          id: string
          is_active: boolean | null
          monthly_limit: number | null
          organization_id: string | null
          period_end: string | null
          period_start: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          alert_threshold?: number | null
          created_at?: string | null
          currency?: string | null
          current_month_usage?: number | null
          id?: string
          is_active?: boolean | null
          monthly_limit?: number | null
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          alert_threshold?: number | null
          created_at?: string | null
          currency?: string | null
          current_month_usage?: number | null
          id?: string
          is_active?: boolean | null
          monthly_limit?: number | null
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_context_snapshots: {
        Row: {
          agent_id: string | null
          context_data: Json
          conversation_id: string
          created_at: string | null
          id: string
          token_count: number | null
        }
        Insert: {
          agent_id?: string | null
          context_data?: Json
          conversation_id: string
          created_at?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          agent_id?: string | null
          context_data?: Json
          conversation_id?: string
          created_at?: string | null
          id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_context_snapshots_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_context_snapshots_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          agent_id: string | null
          context: Json | null
          created_at: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          model_id: string | null
          organization_id: string | null
          project_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          model_id?: string | null
          organization_id?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          model_id?: string | null
          organization_id?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evaluation_runs: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string | null
          evaluation_id: string
          id: string
          input: Json | null
          output: Json | null
          results: Json | null
          score: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          evaluation_id: string
          id?: string
          input?: Json | null
          output?: Json | null
          results?: Json | null
          score?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          evaluation_id?: string
          id?: string
          input?: Json | null
          output?: Json | null
          results?: Json | null
          score?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluation_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluation_runs_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ai_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evaluations: {
        Row: {
          agent_id: string | null
          configuration: Json | null
          created_at: string | null
          description: string | null
          evaluation_type: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          evaluation_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          evaluation_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_events: {
        Row: {
          agent_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          execution_id: string | null
          id: string
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          execution_id?: string | null
          id?: string
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          execution_id?: string | null
          id?: string
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_events_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_execution_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          execution_id: string
          id: string
          input: Json | null
          latency_ms: number | null
          name: string | null
          output: Json | null
          status: string | null
          step_number: number
          step_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          execution_id: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          name?: string | null
          output?: Json | null
          status?: string | null
          step_number: number
          step_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          execution_id?: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          name?: string | null
          output?: Json | null
          status?: string | null
          step_number?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_execution_steps_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_bases: {
        Row: {
          configuration: Json | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string | null
          owner_id: string | null
          slug: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          slug?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          slug?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          knowledge_document_id: string
          metadata: Json | null
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_document_id: string
          metadata?: Json | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_document_id?: string
          metadata?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_chunks_knowledge_document_id_fkey"
            columns: ["knowledge_document_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_documents: {
        Row: {
          content: string | null
          content_hash: string | null
          created_at: string | null
          external_id: string | null
          id: string
          knowledge_source_id: string
          metadata: Json | null
          mime_type: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          knowledge_source_id: string
          metadata?: Json | null
          mime_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          knowledge_source_id?: string
          metadata?: Json | null
          mime_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_documents_knowledge_source_id_fkey"
            columns: ["knowledge_source_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_sources: {
        Row: {
          configuration: Json | null
          created_at: string | null
          external_id: string | null
          id: string
          knowledge_base_id: string
          last_synced_at: string | null
          metadata: Json | null
          name: string
          source_type: string
          source_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          knowledge_base_id: string
          last_synced_at?: string | null
          metadata?: Json | null
          name: string
          source_type: string
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          knowledge_base_id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          name?: string
          source_type?: string
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_sources_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memories: {
        Row: {
          agent_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number | null
          memory_type: string
          metadata: Json | null
          organization_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          memory_type?: string
          metadata?: Json | null
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          memory_type?: string
          metadata?: Json | null
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memories_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory_relations: {
        Row: {
          created_at: string | null
          id: string
          relation_type: string
          source_memory_id: string
          strength: number | null
          target_memory_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relation_type: string
          source_memory_id: string
          strength?: number | null
          target_memory_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relation_type?: string
          source_memory_id?: string
          strength?: number | null
          target_memory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_relations_source_memory_id_fkey"
            columns: ["source_memory_id"]
            isOneToOne: false
            referencedRelation: "ai_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_relations_target_memory_id_fkey"
            columns: ["target_memory_id"]
            isOneToOne: false
            referencedRelation: "ai_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          agent_id: string | null
          content: string | null
          content_json: Json | null
          conversation_id: string
          created_at: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          model_id: string | null
          output_tokens: number | null
          role: string
          tool_calls: Json | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          content?: string | null
          content_json?: Json | null
          conversation_id: string
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_id?: string | null
          output_tokens?: number | null
          role: string
          tool_calls?: Json | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          content?: string | null
          content_json?: Json | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model_id?: string | null
          output_tokens?: number | null
          role?: string
          tool_calls?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_usage: {
        Row: {
          agent_id: string | null
          created_at: string | null
          estimated_cost: number | null
          execution_id: string | null
          id: string
          input_tokens: number | null
          model_id: string | null
          model_key: string | null
          organization_id: string | null
          output_tokens: number | null
          provider: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          execution_id?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          model_key?: string | null
          organization_id?: string | null
          output_tokens?: number | null
          provider?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          execution_id?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          model_key?: string | null
          organization_id?: string | null
          output_tokens?: number | null
          provider?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_usage_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_usage_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_usage_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          context_window: number | null
          created_at: string | null
          display_name: string
          id: string
          input_cost_per_million: number | null
          is_active: boolean | null
          is_default: boolean | null
          max_output_tokens: number | null
          metadata: Json | null
          model_key: string
          model_type: string
          output_cost_per_million: number | null
          provider: string
          supports_json: boolean | null
          supports_streaming: boolean | null
          supports_tools: boolean | null
          supports_vision: boolean | null
          updated_at: string | null
        }
        Insert: {
          context_window?: number | null
          created_at?: string | null
          display_name: string
          id?: string
          input_cost_per_million?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          max_output_tokens?: number | null
          metadata?: Json | null
          model_key: string
          model_type?: string
          output_cost_per_million?: number | null
          provider: string
          supports_json?: boolean | null
          supports_streaming?: boolean | null
          supports_tools?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Update: {
          context_window?: number | null
          created_at?: string | null
          display_name?: string
          id?: string
          input_cost_per_million?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          max_output_tokens?: number | null
          metadata?: Json | null
          model_key?: string
          model_type?: string
          output_cost_per_million?: number | null
          provider?: string
          supports_json?: boolean | null
          supports_streaming?: boolean | null
          supports_tools?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_provider_credentials: {
        Row: {
          created_at: string | null
          encrypted_secret: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          metadata: Json | null
          name: string
          organization_id: string | null
          owner_id: string | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_secret: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          metadata?: Json | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_secret?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_tool_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          execution_id: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          output: Json | null
          status: string | null
          tool_id: string | null
          tool_name: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          execution_id?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          output?: Json | null
          status?: string | null
          tool_id?: string | null
          tool_name?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          execution_id?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          output?: Json | null
          status?: string | null
          tool_id?: string | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_executions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_executions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tools: {
        Row: {
          configuration: Json | null
          created_at: string | null
          description: string | null
          endpoint: string | null
          id: string
          input_schema: Json | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          organization_id: string | null
          output_schema: Json | null
          owner_id: string | null
          requires_auth: boolean | null
          slug: string
          tool_type: string
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          endpoint?: string | null
          id?: string
          input_schema?: Json | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          organization_id?: string | null
          output_schema?: Json | null
          owner_id?: string | null
          requires_auth?: boolean | null
          slug: string
          tool_type?: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          endpoint?: string | null
          id?: string
          input_schema?: Json | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          organization_id?: string | null
          output_schema?: Json | null
          owner_id?: string | null
          requires_auth?: boolean | null
          slug?: string
          tool_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          metadata: Json
          name: string
          organization_id: string | null
          permissions: Json
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          metadata?: Json
          name: string
          organization_id?: string | null
          permissions?: Json
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          metadata?: Json
          name?: string
          organization_id?: string | null
          permissions?: Json
          revoked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          ip_address: unknown
          metadata: Json
          organization_id: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          plan_source: string | null
          processed_at: string | null
          received_at: string
          resolved_plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_event_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          plan_source?: string | null
          processed_at?: string | null
          received_at?: string
          resolved_plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_event_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          plan_source?: string | null
          processed_at?: string | null
          received_at?: string
          resolved_plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_event_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      canvases: {
        Row: {
          created_at: string
          description: string | null
          edges: Json
          id: string
          metadata: Json
          nodes: Json
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          metadata?: Json
          nodes?: Json
          title?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          metadata?: Json
          nodes?: Json
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canvases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          id: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          metadata: Json
          name: string
          rollout_percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          metadata?: Json
          name: string
          rollout_percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          metadata?: Json
          name?: string
          rollout_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          chat_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          name: string
          original_name: string
          size: number
          storage_path: string
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          original_name: string
          size?: number
          storage_path: string
          user_id: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          original_name?: string
          size?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string | null
          payload: Json
          priority: number
          result: Json | null
          scheduled_for: string | null
          started_at: string | null
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge: {
        Row: {
          content: string | null
          created_at: string
          description: string | null
          embedding: Json | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json
          project_id: string | null
          source_url: string | null
          status: string
          tags: string[]
          team_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          description?: string | null
          embedding?: Json | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          team_id?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          description?: string | null
          embedding?: Json | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          team_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment: Json | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          chat_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          attachment?: Json | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          chat_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          attachment?: Json | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          chat_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          id: string
          message: string
          metadata: Json
          priority: string
          read: boolean
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          priority?: string
          read?: boolean
          read_at?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          priority?: string
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          feature_flag_id: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_flag_id: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_flag_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_flags_feature_flag_id_fkey"
            columns: ["feature_flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          owner_id: string
          plan: string
          slug: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_id: string
          plan?: string
          slug: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string | null
          owner_id: string | null
          priority: string | null
          settings: Json
          slug: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string | null
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id?: string | null
          owner_id?: string | null
          priority?: string | null
          settings?: Json
          slug?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          priority?: string | null
          settings?: Json
          slug?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          created_at: string
          endpoint: string
          id: number
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: never
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: never
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string | null
          payload: Json
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id?: string | null
          payload?: Json
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          error: string | null
          id: string
          metadata: Json
          priority: string
          project_id: string | null
          result: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          error?: string | null
          id?: string
          metadata?: Json
          priority?: string
          project_id?: string | null
          result?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          error?: string | null
          id?: string
          metadata?: Json
          priority?: string
          project_id?: string | null
          result?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          owner_id: string | null
          settings: Json
          slug: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_id?: string | null
          settings?: Json
          slug?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string | null
          settings?: Json
          slug?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          period: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          period?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          period?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          memory_enabled: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          memory_enabled?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          memory_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          webhook_endpoint_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_endpoint_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_endpoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_endpoint_id_fkey"
            columns: ["webhook_endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          events: Json
          id: string
          name: string
          organization_id: string | null
          secret_hash: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: Json
          id?: string
          name: string
          organization_id?: string | null
          secret_hash?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: Json
          id?: string
          name?: string
          organization_id?: string | null
          secret_hash?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          input: Json
          organization_id: string | null
          output: Json | null
          started_at: string | null
          status: string
          triggered_by: string | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          input?: Json
          organization_id?: string | null
          output?: Json | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          input?: Json
          organization_id?: string | null
          output?: Json | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          name: string
          position: number
          step_type: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          name: string
          position: number
          step_type: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          name?: string
          position?: number
          step_type?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          description: string | null
          id: string
          name: string
          organization_id: string | null
          settings: Json
          status: string
          updated_at: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_owns_agent: { Args: { agent_uuid: string }; Returns: boolean }
      is_organization_admin: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      is_organization_owner: {
        Args: { target_organization_id: string }
        Returns: boolean
      }
      match_knowledge_chunks: {
        Args: {
          knowledge_base?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          knowledge_document_id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
