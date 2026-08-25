-- Local-dev-only test data, applied after migrations by `supabase db reset`.
-- A default manual so the RAG chat has something to fall back to when a test session
-- doesn't pick one (mirrors sys-rag's `manual_id: null` -> default-manual fallback).
insert into public.syspare_rag_manuals (manual_id, display_name, pdf_folder, cache_dir, image_dir, is_default)
values ('default', 'Default Manual', 'manuals/default', 'cache/default', 'images/default', true)
on conflict (manual_id) do nothing;
