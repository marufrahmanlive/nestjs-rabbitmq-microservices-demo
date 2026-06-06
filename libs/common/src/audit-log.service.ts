import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Document } from "mongoose";
import { AuditLog } from "@app/database";

export interface AuditLogEntry {
  instanceId: string;
  serviceName: string;
  level: "log" | "error" | "warn" | "debug" | "verbose";
  message: string;
  handler?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
  requestData?: Record<string, any>;
  responseData?: Record<string, any>;
  errorStack?: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel("AuditLog")
    private readonly auditLogModel: Model<AuditLog & Document>
  ) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.auditLogModel.create({
        instanceId: entry.instanceId || process.env.INSTANCE_ID || "unknown",
        serviceName: entry.serviceName || process.env.SERVICE_NAME || "unknown",
        level: entry.level,
        message: entry.message,
        handler: entry.handler || "SYSTEM",
        method: entry.method,
        url: entry.url,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        requestData: entry.requestData,
        responseData: entry.responseData,
        errorStack: entry.errorStack,
        metadata: entry.metadata,
        correlationId:
          entry.correlationId || process.env.CORRELATION_ID || undefined
      });
    } catch (err) {
      // Fail silently to not break the main flow if MongoDB is down
      console.error("[AuditLogService] Failed to write audit log:", err);
    }
  }
}
