import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true, collection: "audit_logs" })
export class AuditLog {
  @Prop({ required: true, index: true })
  instanceId!: string;

  @Prop({ required: true, index: true })
  serviceName!: string;

  @Prop({ required: true, index: true })
  level!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: "SYSTEM", index: true })
  handler!: string;

  @Prop()
  method?: string;

  @Prop()
  url?: string;

  @Prop()
  statusCode?: number;

  @Prop()
  durationMs?: number;

  @Prop({ type: Object })
  requestData?: Record<string, any>;

  @Prop({ type: Object })
  responseData?: Record<string, any>;

  @Prop()
  errorStack?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ index: true })
  correlationId?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// TTL index: auto-delete logs older than 30 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
