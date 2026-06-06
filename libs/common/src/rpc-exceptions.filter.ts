import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional
} from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { AuditLogService } from "./audit-log.service";
import { MicroserviceException } from "./microservice-exception";

@Catch()
export class RpcExceptionsFilter implements ExceptionFilter {
  constructor(
    @Optional()
    @Inject(AuditLogService)
    private readonly auditLogService?: AuditLogService
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToRpc();
    const rpcData = ctx.getData();
    const rpcContext = ctx.getContext();
    const pattern = rpcContext?.getPattern?.() || "unknown";

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const serviceName = process.env.SERVICE_NAME || "unknown";

    // Determine status code, message, and error metadata
    let status: number;
    let message: string;
    let errorCode: string | undefined;
    let errorMetadata: Record<string, any> | undefined;
    let exceptionType = "Unknown";

    if (exception instanceof MicroserviceException) {
      status = exception.getStatus();
      const resp = exception.getResponse() as any;
      message = resp.message || exception.message;
      errorCode = exception.errorCode;
      errorMetadata = exception.metadata;
      exceptionType = "MicroserviceException";
    } else if (exception instanceof RpcException) {
      const errorResp = exception.getError();
      if (typeof errorResp === "string") {
        message = errorResp;
        status = HttpStatus.INTERNAL_SERVER_ERROR;
      } else if (errorResp && typeof errorResp === "object") {
        message = (errorResp as any).message || String(errorResp);
        status =
          (errorResp as any).statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = (errorResp as any).errorCode;
      } else {
        message = String(errorResp);
        status = HttpStatus.INTERNAL_SERVER_ERROR;
      }
      exceptionType = "RpcException";
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message =
        typeof resp === "string"
          ? resp
          : (resp as any).message || exception.message;
      errorCode = (resp as any).errorCode;
      exceptionType = exception.constructor?.name || "HttpException";
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || "Internal server error";
      exceptionType = exception.constructor?.name || "Error";
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
    }

    // Save audit log entry for the error
    try {
      if (this.auditLogService) {
        const errorObj =
          exception instanceof Error ? exception : new Error(message);
        await this.auditLogService.log({
          instanceId,
          serviceName,
          level: "error",
          message: `[RPC: ${pattern}] ${status}: ${message}`,
          handler: `RPC: ${pattern}`,
          method: "RPC",
          url: `rpc:${pattern}`,
          statusCode: status,
          requestData: rpcData,
          errorStack: errorObj.stack,
          metadata: {
            errorCode,
            ...errorMetadata,
            exceptionType,
            pattern
          }
        });
      }
    } catch (auditErr) {
      // Fail silently to not break error response flow
      console.error(
        "[RpcExceptionsFilter] Failed to write error audit log:",
        auditErr
      );
    }

    // Re-throw as RpcException so NestJS RPC layer can handle it properly
    if (
      exception instanceof RpcException ||
      exception instanceof MicroserviceException
    ) {
      throw exception;
    }
    throw new RpcException({
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString()
    });
  }
}
