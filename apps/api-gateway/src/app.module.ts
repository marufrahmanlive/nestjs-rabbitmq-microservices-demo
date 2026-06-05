import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@app/rabbitmq";
import { DatabaseModule } from "@app/database";
import { QUEUES } from "@app/contracts";
import { AppLogger } from "@app/common";
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
  providers: [AppLogger]
})
export class AppModule {}
