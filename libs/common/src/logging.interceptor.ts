import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from "@nestjs/common";
import { Observable, tap, catchError, throwError } from "rxjs";
import { Reflector } from "@nestjs/core";
import { AppLogger } from "./logger.service";
import { AuditLogService } from "./audit-log.service";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly reflector = new Reflector();

  constructor(
    private readonly logger: AppLogger,
    private readonly auditLogService: AuditLogService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const type = context.getType();
    const instanceId = process.env.INSTANCE_ID || "unknown";
    const serviceName = process.env.SERVICE_NAME || "unknown";
    let handler = "unknown";
    let method: string | undefined;
    let url: string | undefined;
    let requestData: Record<string, any> | undefined;

    if (type === "http") {
      const req = context.switchToHttp().getRequest();
      handler = `${req.method} ${req.url}`;
      method = req.method;
      url = req.url;
      requestData = {
        body: req.body,
        query: req.query,
        params: req.params
      };
    } else if (type === "rpc") {
      const rpc = context.switchToRpc();
      const data = rpc.getData();

      // Try to resolve the pattern name via NestJS metadata
      const pattern = this.resolveRpcPattern(context);
      handler = `RPC: ${pattern}`;
      method = "RPC";
      url = `rpc:${pattern}`;
      requestData = data;
    }

    return next.handle().pipe(
      tap(response => {
        const elapsed = Date.now() - now;
        this.logger.log(`[${handler}] completed in ${elapsed}ms`);

        // Write success audit log to MongoDB
        this.auditLogService.log({
          instanceId,
          serviceName,
          level: "log",
          message: `[${handler}] completed in ${elapsed}ms`,
          handler,
          method,
          url,
          statusCode: 200,
          durationMs: elapsed,
          requestData,
          responseData: this.sanitizeResponse(response)
        });
      }),
      catchError(error => {
        const elapsed = Date.now() - now;
        this.logger.error(
          `[${handler}] failed in ${elapsed}ms: ${error.message}`
        );

        // Error audit log is saved by AllExceptionsFilter (HTTP)
        // or RpcExceptionsFilter (RPC) — the single source for error logs.
        // Avoid writing duplicate error log entry here.

        return throwError(() => error);
      })
    );
  }

  /**
   * Resolve the MessagePattern/EventPattern name from NestJS metadata.
   * Falls back to the handler method name if no pattern metadata is found.
   */
  private resolveRpcPattern(context: ExecutionContext): string {
    try {
      const handler = context.getHandler();
      // NestJS stores the pattern string as metadata on the handler
      const pattern = this.reflector.get<string>("pattern", handler);
      if (pattern) return pattern;

      // Fallback: use the controller method name
      const methodName = handler?.name;
      if (methodName) return methodName;
    } catch {
      // Silently fallback
    }
    return "unknown_pattern";
  }

  private sanitizeResponse(response: any): Record<string, any> | undefined {
    if (!response) return undefined;
    if (typeof response === "object") {
      try {
        // Truncate large response bodies for storage
        const str = JSON.stringify(response);
        if (str.length > 5000) {
          return { _truncated: true, preview: str.substring(0, 1000) };
        }
        return response;
      } catch {
        return { _type: typeof response };
      }
    }
    return { value: String(response).substring(0, 1000) };
  }
}
