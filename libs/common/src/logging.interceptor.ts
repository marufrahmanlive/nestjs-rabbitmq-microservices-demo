import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AppLogger } from "./logger.service";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const type = context.getType();
    let handler = "unknown";

    if (type === "http") {
      const req = context.switchToHttp().getRequest();
      handler = `${req.method} ${req.url}`;
    } else if (type === "rpc") {
      const rpc = context.switchToRpc();
      const data = rpc.getData();
      handler = `RPC: ${JSON.stringify(data).substring(0, 100)}`;
    }

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - now;
        this.logger.log(`[${handler}] completed in ${elapsed}ms`);
      })
    );
  }
}
