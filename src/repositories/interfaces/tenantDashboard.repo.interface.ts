export interface TenantDashboardDTO {
  id: string;
  tenantId: string;
  workspaceId: string;
  dashboardId: string;
  createdAt: Date;
}

export interface ITenantDashboardRepo {
  findByTenantId(tenantId: string): Promise<TenantDashboardDTO | null>;
  create(data: { tenantId: string; workspaceId: string; dashboardId: string }): Promise<TenantDashboardDTO>;
  upsertByTenantId(data: { tenantId: string; workspaceId: string; dashboardId: string }): Promise<TenantDashboardDTO>;
}
