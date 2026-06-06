import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "@app/database";
import {
  AppLogger,
  AuditLogService,
  LoggingInterceptor,
  RpcExceptionsFilter
} from "@app/common";
import { NotificationController } from "./notification.controller";

@Module({
  imports: [DatabaseModule.register()],
  controllers: [NotificationController],
  providers: [
    AppLogger,
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: RpcExceptionsFilter
    }
  ]
})
export class AppModule {}
