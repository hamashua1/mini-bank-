import mongoose, { Document, Schema } from 'mongoose';

export interface ITenantDashboard extends Document {
  tenantId: mongoose.Types.ObjectId;
  workspaceId: string;
  dashboardId: string;
  createdAt: Date;
}

const tenantDashboardSchema = new Schema<ITenantDashboard>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    workspaceId: { type: String, required: true },
    dashboardId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TenantDashboardModel = mongoose.model<ITenantDashboard>('TenantDashboard', tenantDashboardSchema);
