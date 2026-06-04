import { Module } from "@nestjs/common";
import { DatabaseModule } from "@app/database";
import { RabbitMQModule } from "@app/rabbitmq";
import { QUEUES } from "@app/contracts";
import { AppLogger } from "@app/common";
import { PaymentController } from "./payment.controller";

@Module({
  imports: [
    DatabaseModule.register(),
    RabbitMQModule.register({
      queues: [QUEUES.NOTIFICATION_QUEUE]
    })
  ],
  controllers: [PaymentController],
  providers: [AppLogger]
})
export class AppModule {}
