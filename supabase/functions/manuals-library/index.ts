// Self-service manual upload/management for the app's "Manuals" screen (Settings -> Manage
// manuals). Mirrors workify-web's app/api/rag/upload, app/api/rag/upload/status, and
// app/api/organizations/[id]/documents/[documentId] routes -- same org, capacity, and RAG-backend
// contract, just consolidated into one action-dispatched function (see org-manage's own comment
// for why: one deploy instead of several).
//
// Distinct from rag-manuals (which proxies sys-rag's GET /api/manuals for the chat manual
// picker, global + org-private manuals a user can *query*). This function is about the org's own
// uploaded library -- the workify_workspace_documents rows web's dashboard shows, which is what
// counts against library capacity.
//
// Request shapes:
//   POST multipart/form-data { file, displayName? }        -> upload, returns { ok, manualId, displayName, pageCount, jobId }
//   POST application/json { action: 'list' }                -> { documents, capacity }
//   POST application/json { action: 'status', jobId, manualId, displayName, pageCount }
//                                                            -> { status, progress, message }
//   POST application/json { action: 'delete', document_id } -> { ok: true } (manager-only)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getOrgLibraryCapacity, isOrgAccessBlocked, isOrgManager } from '../_shared/org.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RAG_API_URL = Deno.env.get('RAG_API_URL') ?? 'https://syspare-rag-py.onrender.com';

function slugifyManualId(filename: string): string {
  const base = filename.replace(/\.pdf$/i, '');
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'manual'}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleUpload(req: Request, admin: ReturnType<typeof createClient>, userId: string) {
  const { data: membership } = await admin
    .from('workify_organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!membership) {
    return jsonResponse(
      { error: 'no_organization', message: 'Choose a plan or accept an invite to get started.' },
      402
    );
  }
  const organizationId = membership.organization_id as string;

  if (await isOrgAccessBlocked(admin, organizationId)) {
    return jsonResponse(
      { error: 'organization_inactive', message: "This organization's subscription is not active." },
      402
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const displayNameInput = formData.get('displayName');

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf')) {
    return jsonResponse({ error: 'invalid_file', message: 'A PDF file is required.' }, 400);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
  } catch {
    return jsonResponse(
      { error: 'invalid_pdf', message: 'Could not read PDF -- file may be corrupt or unsupported.' },
      400
    );
  }

  const capacity = await getOrgLibraryCapacity(admin, organizationId);
  if (capacity.usedPages + pageCount > capacity.limitPages) {
    return jsonResponse(
      {
        error: 'capacity_exceeded',
        message: `This upload (${pageCount} pages) would exceed your library capacity (${capacity.usedPages}/${capacity.limitPages} pages used).`,
        usedPages: capacity.usedPages,
        limitPages: capacity.limitPages,
        pageCount,
      },
      409
    );
  }

  const manualId = slugifyManualId(file.name);
  const displayName =
    (typeof displayNameInput === 'string' && displayNameInput.trim()) ||
    file.name.replace(/\.pdf$/i, '');

  const addManualForm = new FormData();
  addManualForm.set('manual_id', manualId);
  addManualForm.set('display_name', displayName);
  addManualForm.set('organization_id', organizationId);
  addManualForm.set('files', new Blob([buffer], { type: 'application/pdf' }), file.name);

  const addManualRes = await fetch(`${RAG_API_URL}/api/add-manual`, {
    method: 'POST',
    body: addManualForm,
  });

  if (!addManualRes.ok) {
    const detail = await addManualRes.text().catch(() => '');
    return jsonResponse(
      { error: 'add_manual_failed', message: 'Failed to register manual with the RAG backend.', detail },
      502
    );
  }

  const trainUrl = new URL(`${RAG_API_URL}/api/training/start`);
  trainUrl.searchParams.set('manual_id', manualId);
  trainUrl.searchParams.set('organization_id', organizationId);

  const trainRes = await fetch(trainUrl, { method: 'POST' });
  const trainJson = await trainRes.json().catch(() => null);

  if (!trainRes.ok || !trainJson?.ok) {
    const removeUrl = new URL(`${RAG_API_URL}/api/remove-manual`);
    removeUrl.searchParams.set('manual_id', manualId);
    removeUrl.searchParams.set('organization_id', organizationId);
    await fetch(removeUrl, { method: 'POST' }).catch(() => {});

    return jsonResponse(
      { error: 'training_start_failed', message: 'Manual registered but training failed to start.', detail: trainJson },
      502
    );
  }

  return jsonResponse({
    ok: true,
    manualId,
    displayName,
    pageCount,
    jobId: trainJson.job_id,
  });
}

async function handleList(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: membership } = await admin
    .from('workify_organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!membership) {
    return jsonResponse(
      { error: 'no_organization', message: 'Choose a plan or accept an invite to get started.' },
      402
    );
  }
  const organizationId = membership.organization_id as string;

  const [{ data: documents }, capacity] = await Promise.all([
    admin
      .from('workify_workspace_documents')
      .select('id, manual_id, filename, page_count, created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    getOrgLibraryCapacity(admin, organizationId),
  ]);

  return jsonResponse({
    documents: documents ?? [],
    capacity,
    role: membership.role,
  });
}

async function handleStatus(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { jobId?: string; manualId?: string; displayName?: string; pageCount?: number }
) {
  const { jobId, manualId, displayName, pageCount } = body;
  if (!jobId || !manualId || !displayName || typeof pageCount !== 'number') {
    return jsonResponse(
      { error: 'invalid_request', message: 'jobId, manualId, displayName, and pageCount are all required.' },
      400
    );
  }

  const { data: membership } = await admin
    .from('workify_organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: 'no_organization' }, 402);
  }
  const organizationId = membership.organization_id as string;

  const statusUrl = new URL(`${RAG_API_URL}/api/training/status`);
  statusUrl.searchParams.set('job_id', jobId);

  const statusRes = await fetch(statusUrl);
  const statusJson = await statusRes.json().catch(() => null);

  if (!statusRes.ok || !statusJson) {
    return jsonResponse({ error: 'status_fetch_failed', message: 'Failed to fetch training status.' }, 502);
  }

  if (statusJson.status === 'done') {
    const { data: existing } = await admin
      .from('workify_workspace_documents')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('manual_id', manualId)
      .eq('status', 'active')
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await admin.from('workify_workspace_documents').insert({
        organization_id: organizationId,
        uploaded_by: userId,
        manual_id: manualId,
        filename: displayName,
        page_count: pageCount,
      });

      if (insertError && insertError.code !== '23505') {
        console.error('[manuals-library] failed to record workspace document', insertError);
      }
    }
  }

  return jsonResponse({
    status: statusJson.status,
    progress: statusJson.progress,
    message: statusJson.message,
  });
}

async function handleDelete(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { document_id?: string }
) {
  if (!body.document_id) {
    return jsonResponse({ error: 'invalid_request', message: 'document_id is required.' }, 400);
  }

  const { data: membership } = await admin
    .from('workify_organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: 'no_organization' }, 402);
  }
  const organizationId = membership.organization_id as string;

  const isManager = await isOrgManager(admin, organizationId, userId);
  if (!isManager) {
    return jsonResponse({ error: 'forbidden', message: 'Owner/admin role required.' }, 403);
  }

  const { data: document } = await admin
    .from('workify_workspace_documents')
    .select('id, manual_id')
    .eq('id', body.document_id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();

  if (!document) {
    return jsonResponse({ error: 'not_found', message: 'Document not found.' }, 404);
  }

  if (document.manual_id) {
    const removeUrl = new URL(`${RAG_API_URL}/api/remove-manual`);
    removeUrl.searchParams.set('manual_id', document.manual_id);
    removeUrl.searchParams.set('organization_id', organizationId);

    const removeRes = await fetch(removeUrl, { method: 'POST' });
    const removeJson = await removeRes.json().catch(() => null);

    if (!removeRes.ok || !removeJson?.ok) {
      return jsonResponse(
        { error: 'remove_manual_failed', message: 'Failed to remove manual from the RAG backend.', detail: removeJson },
        502
      );
    }
  }

  await admin
    .from('workify_workspace_documents')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', document.id);

  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    try {
      return await handleUpload(req, admin, user.id);
    } catch (err) {
      return jsonResponse(
        { error: 'request_failed', message: err instanceof Error ? err.message : String(err) },
        500
      );
    }
  }

  let body: { action?: string; [key: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  try {
    switch (body.action) {
      case 'list':
      case undefined:
        return await handleList(admin, user.id);
      case 'status':
        return await handleStatus(admin, user.id, body);
      case 'delete':
        return await handleDelete(admin, user.id, body);
      default:
        return jsonResponse({ error: 'unknown_action' }, 400);
    }
  } catch (err) {
    return jsonResponse(
      { error: 'request_failed', message: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
