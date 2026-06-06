import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "@app/database";
import { AllExceptionsFilter, AuditLogService } from "@app/common";
import { LogsController } from "./logs.controller";

@Module({
  imports: [DatabaseModule.register()],
  controllers: [LogsController],
  providers: [
    AuditLogService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter
    }
  ]
})
export class AppModule {}
