# SYRAVEN

> The intelligent workspace for the future.

SYRAVEN is an AI-powered workspace designed to bring intelligent conversations, persistent memory, document interaction, coding assistance, and AI tools together in one unified environment.

The project focuses on creating a clean and modern AI workspace where users can have conversations, manage chats, interact with AI-generated content, and build a more personalized experience through persistent memory.

---

## ✨ Features

### 💬 AI Chat

Interact with advanced AI models through a modern chat interface.

Features include:

- Real-time streaming responses
- Conversation history
- Multiple chat sessions
- Persistent messages
- Markdown rendering
- GitHub Flavored Markdown support
- Syntax highlighting for code blocks
- Long-form AI responses

---

### 🧠 Persistent Memory

SYRAVEN can store useful long-term information about a user to create more personalized conversations.

Examples include:

- Name
- Location
- Education
- Career goals
- Long-term plans
- Interests
- Preferences
- Hobbies
- Explicitly requested memories

The memory system analyzes user messages and avoids storing temporary or sensitive information such as passwords, API keys, authentication tokens, banking information, or security codes.

Users can enable or disable memory through their settings.

---

### 📄 Document Intelligence

The application includes document-related functionality and dependencies for working with multiple file formats.

Supported processing capabilities include:

- PDF
- DOCX
- PPTX

Users can upload files and interact with document content inside the workspace.

---

### 💻 AI Coding Experience

SYRAVEN supports technical conversations and code-focused workflows.

The interface includes:

- Markdown rendering
- Code block rendering
- Syntax highlighting
- Technical AI assistance

---

### ⚡ Streaming Responses

AI responses are streamed in real time.

The application uses a streaming API route to send generated content to the client progressively instead of waiting for the complete response.

---

### 🔐 Authentication

Authentication is handled with Supabase.

The application validates the authenticated user before processing protected AI requests.

User-specific data such as chats, messages, memories, and settings are separated through user IDs.

---

## 🏗️ Architecture

The application is built using a modern full-stack architecture.

```text
┌─────────────────────┐
│      Next.js App    │
│                     │
│  React + TypeScript │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     API Routes      │
│                     │
│ /api/chat           │
│ /api/stream         │
└──────────┬──────────┘
           │
           ├──────────────────► Groq AI API
           │
           ▼
┌─────────────────────┐
│      Supabase       │
│                     │
│ Authentication      │
│ Database            │
│ Row Level Security  │
└─────────────────────┘