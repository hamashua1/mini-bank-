import mongoose, { Document, Schema } from 'mongoose';

export interface ITenantDashboard extends Document {
  tenantId: mongoose.Types.ObjectId;
  workspaceId: string;
  dashboardId: string;
  createdAt: Date;
}

const tenantDashboardSchema = new Schema<ITenantDashboard>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: String, required: true },
    dashboardId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One dashboard record per user per workspace — switching DB never overwrites a previous workspace's dashboard
tenantDashboardSchema.index({ tenantId: 1, workspaceId: 1 }, { unique: true });

export const TenantDashboardModel = mongoose.model<ITenantDashboard>('TenantDashboard', tenantDashboardSchema);
