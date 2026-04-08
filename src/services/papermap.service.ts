import crypto from 'crypto';

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

export async function createPapermapDashboard(userEmail: string): Promise<string> {
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

// Generates the base64-encoded token passed to PapermapConfigProvider.
// Token encodes: api_key_id, workspace_id, valid_until (1 hour), signature, dashboard_id.
export function generatePapermapToken(dashboardId: string): string {
  const validUntil = Math.floor(Date.now() / 1000) + 3600;
  const signature = createSignature(
    process.env.PAPERMAP_WORKSPACE_ID as string,
    String(validUntil)
  );
  const payload = {
    api_key_id: process.env.PAPERMAP_API_KEY_ID,
    workspace_id: process.env.PAPERMAP_WORKSPACE_ID,
    valid_until: validUntil,
    signature,
    dashboard_id: dashboardId,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
