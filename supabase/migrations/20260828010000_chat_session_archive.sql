-- Lets mobile users archive a chat session out of the main list without deleting it.
-- Mobile-only addition (workify-web has no archive concept for rag_chat_sessions today) -- this
-- only adds a column with a safe default, so it doesn't change any existing web behavior.
alter table public.rag_chat_sessions
  add column if not exists is_archived boolean not null default false;
