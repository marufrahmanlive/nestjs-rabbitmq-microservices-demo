import { Module } from "@nestjs/common";
import { DatabaseModule } from "@app/database";
import { OrderController } from "./order.controller";
import { RabbitMQModule } from "@app/rabbitmq";
import { QUEUES } from "@app/contracts";
import { AppLogger } from "@app/common";

@Module({
  imports: [
    DatabaseModule.register(),
    RabbitMQModule.register({
      queues: [QUEUES.PAYMENT_QUEUE, QUEUES.NOTIFICATION_QUEUE]
    })
  ],
  controllers: [OrderController],
  providers: [AppLogger]
})
export class AppModule {}
