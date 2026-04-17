export interface TenantDashboardDTO {
  id: string;
  tenantId: string;
  workspaceId: string;
  dashboardId: string;
  createdAt: Date;
}

export interface ITenantDashboardRepo {
  findByTenantAndWorkspace(tenantId: string, workspaceId: string): Promise<TenantDashboardDTO | null>;
  create(data: { tenantId: string; workspaceId: string; dashboardId: string }): Promise<TenantDashboardDTO>;
  upsertByTenantAndWorkspace(data: { tenantId: string; workspaceId: string; dashboardId: string }): Promise<TenantDashboardDTO>;
}
