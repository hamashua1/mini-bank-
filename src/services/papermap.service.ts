import crypto from 'crypto';
import { TenantDashboardRepo } from '../repositories/registry';
import { getDbType } from '../types/db';

// Returns the correct Papermap credentials based on which DB is active.
// mongo  → PAPERMAP_API_KEY_ID / PAPERMAP_SECRET_KEY / PAPERMAP_WORKSPACE_ID
// postgres → PAPERMAP_API_KEY_ID_POSTGRES / ...
// mysql  → PAPERMAP_API_KEY_ID_SQL / ...
function getPapermapCreds(): { apiKeyId: string; secretKey: string; workspaceId: string } {
  const db = getDbType();

  if (db === 'postgres') {
    return {
      apiKeyId: process.env.PAPERMAP_API_KEY_ID_POSTGRES as string,
      secretKey: process.env.PAPERMAP_SECRET_KEY_POSTGRES as string,
      workspaceId: process.env.PAPERMAP_WORKSPACE_ID_POSTGRES as string,
    };
  }

  if (db === 'mysql') {
    return {
      apiKeyId: process.env.PAPERMAP_API_KEY_ID_SQL as string,
      secretKey: process.env.PAPERMAP_SECRET_KEY_SQL as string,
      workspaceId: process.env.PAPERMAP_WORKSPACE_ID_SQL as string,
    };
  }

  // Default: mongo
  return {
    apiKeyId: process.env.PAPERMAP_API_KEY_ID as string,
    secretKey: process.env.PAPERMAP_SECRET_KEY as string,
    workspaceId: process.env.PAPERMAP_WORKSPACE_ID as string,
  };
}

function createSignature(workspaceId: string, validUntil: string, secretKey: string): string {
  const payload = `${workspaceId}${validUntil}`;
  return crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
}

function getAuthHeaders(): Record<string, string> {
  const { apiKeyId, secretKey, workspaceId } = getPapermapCreds();
  const validUntil = String(Math.floor(Date.now() / 1000) + 300);
  return {
    'X-API-Key-ID': apiKeyId,
    'X-Workspace-ID': workspaceId,
    'X-Valid-Until': validUntil,
    'X-Signature': createSignature(workspaceId, validUntil, secretKey),
    'Content-Type': 'application/json',
  };
}

async function createDashboardOnPapermap(tenantId: string, userEmail: string): Promise<string> {
  const { workspaceId } = getPapermapCreds();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch('https://dev.dataapi.papermap.ai/api/v1/external/dashboards', {
      method: 'POST',
      headers: getAuthHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        workspace_id: workspaceId,
        tenant_id: tenantId,
        title: `Mini Bank - ${userEmail}`,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Papermap dashboard creation failed (${response.status}): ${body}`);
  }

  const json = await response.json() as { data: { dashboard_id: string } };
  return json.data.dashboard_id;
}

export async function getOrCreateTenantDashboard(userId: string, userEmail: string): Promise<string> {
  const { workspaceId } = getPapermapCreds();
  const existing = await TenantDashboardRepo.findByTenantAndWorkspace(userId, workspaceId);
  if (existing) return existing.dashboardId;

  const dashboardId = await createDashboardOnPapermap(userId, userEmail);

  await TenantDashboardRepo.upsertByTenantAndWorkspace({
    tenantId: userId,
    workspaceId,
    dashboardId,
  });

  return dashboardId;
}

export function generatePapermapToken(dashboardId: string, userId: string): string {
  const { apiKeyId, secretKey, workspaceId } = getPapermapCreds();
  const validUntil = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const signature = createSignature(workspaceId, String(validUntil), secretKey);
  const payload = {
    api_key_id: apiKeyId,
    workspace_id: workspaceId,
    tenant_id: userId,
    dashboard_id: dashboardId,
    valid_until: validUntil,
    signature,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
