import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";
import { generateInstanceId } from "@app/common";
import { AppLogger } from "@app/common";
import { QUEUES } from "@app/contracts";

async function bootstrap() {
  const instanceId = generateInstanceId();
  process.env.INSTANCE_ID = instanceId;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || "amqp://localhost:5672"],
        queue: QUEUES.ORDER_QUEUE,
        queueOptions: { durable: true }
      },
      logger: new AppLogger(`ORDER-SERVICE-${instanceId}`)
    }
  );

  await app.listen();
  console.log(
    `[ORDER-SERVICE] Instance ${instanceId} listening on queue: ${QUEUES.ORDER_QUEUE}`
  );
}
bootstrap();
