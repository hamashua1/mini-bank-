import { TenantDashboardModel } from '../../models/tenantDashboard.model';
import { ITenantDashboardRepo, TenantDashboardDTO } from '../interfaces/tenantDashboard.repo.interface';

function toDTO(doc: any): TenantDashboardDTO {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    workspaceId: doc.workspaceId,
    dashboardId: doc.dashboardId,
    createdAt: doc.createdAt,
  };
}

export const MongoTenantDashboardRepo: ITenantDashboardRepo = {
  async findByTenantAndWorkspace(tenantId, workspaceId) {
    const doc = await TenantDashboardModel.findOne({ tenantId, workspaceId });
    return doc ? toDTO(doc) : null;
  },

  async create(data) {
    const doc = await TenantDashboardModel.create(data);
    return toDTO(doc);
  },

  async upsertByTenantAndWorkspace(data) {
    const doc = await TenantDashboardModel.findOneAndUpdate(
      { tenantId: data.tenantId, workspaceId: data.workspaceId },
      { $set: { dashboardId: data.dashboardId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return toDTO(doc);
  },
};
