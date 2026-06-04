import { Module, DynamicModule } from "@nestjs/common";
import { MongooseModule, MongooseModuleOptions } from "@nestjs/mongoose";
import { OrderSchema } from "./schemas/order.schema";
import { PaymentSchema } from "./schemas/payment.schema";
import { NotificationSchema } from "./schemas/notification.schema";

@Module({})
export class DatabaseModule {
  static register(uri?: string): DynamicModule {
    const mongoUri =
      uri ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/microservices-demo";

    const options: MongooseModuleOptions = {};

    return {
      module: DatabaseModule,
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({
            uri: mongoUri,
            ...options
          })
        }),
        MongooseModule.forFeature([
          { name: "Order", schema: OrderSchema },
          { name: "Payment", schema: PaymentSchema },
          { name: "Notification", schema: NotificationSchema }
        ])
      ],
      exports: [MongooseModule]
    };
  }
}
