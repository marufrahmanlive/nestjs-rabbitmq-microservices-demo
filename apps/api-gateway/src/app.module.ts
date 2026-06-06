import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { RabbitMQModule } from "@app/rabbitmq";
import { DatabaseModule } from "@app/database";
import { QUEUES } from "@app/contracts";
import {
  AppLogger,
  LoggingInterceptor,
  AuditLogService,
  AllExceptionsFilter
} from "@app/common";
import { OrderController } from "./order.controller";
import { QueryController } from "./query.controller";

@Module({
  imports: [
    RabbitMQModule.register({
      queues: [QUEUES.ORDER_QUEUE]
    }),
    DatabaseModule.register()
  ],
  controllers: [OrderController, QueryController],
  providers: [
    AppLogger,
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter
    }
  ]
})
export class AppModule {}
