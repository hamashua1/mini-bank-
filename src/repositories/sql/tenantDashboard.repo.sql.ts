import { getPrismaClient } from '../../db/prisma';
import { ITenantDashboardRepo, TenantDashboardDTO } from '../interfaces/tenantDashboard.repo.interface';

function toDTO(d: any): TenantDashboardDTO {
  return {
    id: d.id,
    tenantId: d.tenantId,
    workspaceId: d.workspaceId,
    dashboardId: d.dashboardId,
    createdAt: d.createdAt,
  };
}

export const SqlTenantDashboardRepo: ITenantDashboardRepo = {
  async findByTenantId(tenantId) {
    const prisma = getPrismaClient();
    const doc = await prisma.tenantDashboard.findUnique({ where: { tenantId } });
    return doc ? toDTO(doc) : null;
  },

  async create(data) {
    const prisma = getPrismaClient();
    const doc = await prisma.tenantDashboard.create({ data });
    return toDTO(doc);
  },
};
