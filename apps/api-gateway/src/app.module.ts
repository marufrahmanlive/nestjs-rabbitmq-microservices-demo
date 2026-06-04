import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@app/rabbitmq";
import { QUEUES } from "@app/contracts";
import { AppLogger } from "@app/common";
import { OrderController } from "./order.controller";

@Module({
  imports: [
    RabbitMQModule.register({
      queues: [QUEUES.ORDER_QUEUE]
    })
  ],
  controllers: [OrderController],
  providers: [AppLogger]
})
export class AppModule {}
