import { Controller, Inject } from "@nestjs/common";
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
  ClientProxy
} from "@nestjs/microservices";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  MESSAGE_PATTERNS,
  EVENT_PATTERNS,
  QUEUES,
  OrderCreatedEvent
} from "@app/contracts";
import { Order } from "@app/database";
import { AppLogger, formatLogMessage } from "@app/common";

@Controller()
export class OrderController {
  constructor(
    @InjectModel("Order") private readonly orderModel: Model<Order>,
    @Inject(`${QUEUES.PAYMENT_QUEUE}_CLIENT`)
    private readonly paymentClient: ClientProxy,
    @Inject(`${QUEUES.NOTIFICATION_QUEUE}_CLIENT`)
    private readonly notificationClient: ClientProxy,
    private readonly logger: AppLogger
  ) {}

  @MessagePattern(MESSAGE_PATTERNS.CREATE_ORDER)
  async handleCreateOrder(
    @Payload() data: any,
    @Ctx() context: RmqContext
  ): Promise<any> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const logPrefix = formatLogMessage(
      `ORDER-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.ORDER_QUEUE,
      MESSAGE_PATTERNS.CREATE_ORDER
    );

    this.logger.log(
      `\n${logPrefix}\nProcessing order: ${JSON.stringify(data)}`
    );

    try {
      const order = await this.orderModel.create({
        customerId: data.customerId,
        productName: data.productName,
        quantity: data.quantity,
        amount: data.amount,
        status: "created",
        notes: data.notes
      });

      const event = new OrderCreatedEvent({
        orderId: order._id.toString(),
        customerId: data.customerId,
        productName: data.productName,
        quantity: data.quantity,
        amount: data.amount,
        createdAt: new Date().toISOString()
      });

      // Emit order_created event to payment queue (Event Pattern)
      this.paymentClient.emit(EVENT_PATTERNS.ORDER_CREATED, event);

      // Emit order_created event to notification queue (Event Pattern)
      this.notificationClient.emit(EVENT_PATTERNS.ORDER_CREATED, event);

      this.logger.log(
        `\n${logPrefix}\nOrder ${order._id} created. Emitted order_created event to payment & notification queues.`
      );

      return { success: true, orderId: order._id };
    } catch (error: any) {
      this.logger.error(
        `\n${logPrefix}\nError creating order: ${error.message}`
      );
      throw error;
    }
  }
}
