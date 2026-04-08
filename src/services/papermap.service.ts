import crypto from 'crypto';
import mongoose from 'mongoose';
import { TenantDashboardModel } from '../models/tenantDashboard.model';

function createSignature(workspaceId: string, validUntil: string): string {
  const payload = `${workspaceId}${validUntil}`;
  return crypto
    .createHmac('sha256', process.env.PAPERMAP_SECRET_KEY as string)
    .update(payload)
    .digest('hex');
}

function getAuthHeaders(): Record<string, string> {
  const validUntil = String(Math.floor(Date.now() / 1000) + 300);
  return {
    'X-API-Key-ID': process.env.PAPERMAP_API_KEY_ID as string,
    'X-Workspace-ID': process.env.PAPERMAP_WORKSPACE_ID as string,
    'X-Valid-Until': validUntil,
    'X-Signature': createSignature(process.env.PAPERMAP_WORKSPACE_ID as string, validUntil),
    'Content-Type': 'application/json',
  };
}

async function createDashboardOnPapermap(tenantId: string, userEmail: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch('https://dev.dataapi.papermap.ai/api/v1/external/dashboards', {
      method: 'POST',
      headers: getAuthHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        workspace_id: process.env.PAPERMAP_WORKSPACE_ID,
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

// Looks up existing tenant→dashboard mapping, or creates one on Papermap and stores it.
// tenantId is the User._id (ObjectId) — stored as a foreign key reference to User.
export async function getOrCreateTenantDashboard(
  userId: mongoose.Types.ObjectId,
  userEmail: string
): Promise<string> {
  const existing = await TenantDashboardModel.findOne({ tenantId: userId });
  if (existing) return existing.dashboardId;

  const dashboardId = await createDashboardOnPapermap(userId.toString(), userEmail);

  await TenantDashboardModel.create({
    tenantId: userId,
    workspaceId: process.env.PAPERMAP_WORKSPACE_ID,
    dashboardId,
  });

  return dashboardId;
}

// Generates the base64-encoded token passed to PapermapConfigProvider.
// tenant_id scopes all AI queries to this user's data only.
export function generatePapermapToken(dashboardId: string, userId: string): string {
  const validUntil = Math.floor(Date.now() / 1000) + 3600;
  const signature = createSignature(
    process.env.PAPERMAP_WORKSPACE_ID as string,
    String(validUntil)
  );
  const payload = {
    api_key_id: process.env.PAPERMAP_API_KEY_ID,
    workspace_id: process.env.PAPERMAP_WORKSPACE_ID,
    tenant_id: userId,
    dashboard_id: dashboardId,
    valid_until: validUntil,
    signature,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
