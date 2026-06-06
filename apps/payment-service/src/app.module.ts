import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "@app/database";
import { RabbitMQModule } from "@app/rabbitmq";
import { QUEUES } from "@app/contracts";
import {
  AppLogger,
  AuditLogService,
  LoggingInterceptor,
  RpcExceptionsFilter
} from "@app/common";
import { PaymentController } from "./payment.controller";

@Module({
  imports: [
    DatabaseModule.register(),
    RabbitMQModule.register({
      queues: [QUEUES.NOTIFICATION_QUEUE]
    })
  ],
  controllers: [PaymentController],
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
