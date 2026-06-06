import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "@app/database";
import { OrderController } from "./order.controller";
import { RabbitMQModule } from "@app/rabbitmq";
import { QUEUES } from "@app/contracts";
import {
  AppLogger,
  AuditLogService,
  LoggingInterceptor,
  RpcExceptionsFilter
} from "@app/common";

@Module({
  imports: [
    DatabaseModule.register(),
    RabbitMQModule.register({
      queues: [QUEUES.PAYMENT_QUEUE, QUEUES.NOTIFICATION_QUEUE]
    })
  ],
  controllers: [OrderController],
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
