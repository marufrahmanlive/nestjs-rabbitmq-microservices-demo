import { Module, DynamicModule } from "@nestjs/common";
import {
  ClientsModule,
  Transport,
  ClientProviderOptions
} from "@nestjs/microservices";
import { QUEUES } from "@app/contracts";

interface RabbitMQModuleOptions {
  queues: string[];
  urls?: string[];
}

@Module({})
export class RabbitMQModule {
  static register(options: RabbitMQModuleOptions): DynamicModule {
    const clients: ClientProviderOptions[] = options.queues.map(queue => ({
      name: `${queue}_CLIENT`,
      transport: Transport.RMQ,
      options: {
        urls: options.urls || [
          process.env.RABBITMQ_URL || "amqp://localhost:5672"
        ],
        queue,
        queueOptions: {
          durable: true
        }
      }
    }));

    return {
      module: RabbitMQModule,
      imports: [ClientsModule.register(clients)],
      exports: [ClientsModule]
    };
  }

  static registerAll(): DynamicModule {
    const allQueues = [
      QUEUES.ORDER_QUEUE,
      QUEUES.PAYMENT_QUEUE,
      QUEUES.NOTIFICATION_QUEUE
    ];

    return RabbitMQModule.register({
      queues: allQueues,
      urls: [process.env.RABBITMQ_URL || "amqp://localhost:5672"]
    });
  }
}
