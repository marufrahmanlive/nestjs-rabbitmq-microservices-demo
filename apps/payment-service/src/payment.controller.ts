import { Controller, Inject } from "@nestjs/common";
import {
  Ctx,
  EventPattern,
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
  OrderCreatedEvent,
  PaymentProcessedEvent
} from "@app/contracts";
import { Payment } from "@app/database";
import { AppLogger, formatLogMessage } from "@app/common";

@Controller()
export class PaymentController {
  constructor(
    @InjectModel("Payment") private readonly paymentModel: Model<Payment>,
    @Inject(`${QUEUES.NOTIFICATION_QUEUE}_CLIENT`)
    private readonly notificationClient: ClientProxy,
    private readonly logger: AppLogger
  ) {}

  @EventPattern(EVENT_PATTERNS.ORDER_CREATED)
  async handleOrderCreated(
    @Payload() event: OrderCreatedEvent,
    @Ctx() context: RmqContext
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const logPrefix = formatLogMessage(
      `PAYMENT-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.PAYMENT_QUEUE,
      EVENT_PATTERNS.ORDER_CREATED
    );

    this.logger.log(
      `\n${logPrefix}\nReceived order_created event. Auto-processing payment for order: ${event.orderId}`
    );

    try {
      const payment = await this.paymentModel.create({
        orderId: event.orderId,
        customerId: event.customerId,
        amount: event.amount,
        status: "completed"
      });

      const paymentEvent = new PaymentProcessedEvent({
        orderId: event.orderId,
        paymentId: payment._id.toString(),
        customerId: event.customerId,
        amount: event.amount,
        status: "success",
        processedAt: new Date().toISOString()
      });

      // Emit payment_processed event to notification queue
      this.notificationClient.emit(
        EVENT_PATTERNS.PAYMENT_PROCESSED,
        paymentEvent
      );

      this.logger.log(
        `\n${logPrefix}\nPayment ${payment._id} processed for order ${event.orderId}. Emitted payment_processed event.`
      );
    } catch (error: any) {
      this.logger.error(
        `\n${logPrefix}\nError processing payment: ${error.message}`
      );
      throw error;
    }
  }

  @MessagePattern(MESSAGE_PATTERNS.PROCESS_PAYMENT)
  async handleProcessPayment(
    @Payload() data: any,
    @Ctx() context: RmqContext
  ): Promise<any> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const logPrefix = formatLogMessage(
      `PAYMENT-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.PAYMENT_QUEUE,
      MESSAGE_PATTERNS.PROCESS_PAYMENT
    );

    this.logger.log(
      `\n${logPrefix}\nManual payment processing: ${JSON.stringify(data)}`
    );

    try {
      const payment = await this.paymentModel.create({
        orderId: data.orderId,
        customerId: data.customerId,
        amount: data.amount,
        status: "completed"
      });

      const paymentEvent = new PaymentProcessedEvent({
        orderId: data.orderId,
        paymentId: payment._id.toString(),
        customerId: data.customerId,
        amount: data.amount,
        status: "success",
        processedAt: new Date().toISOString()
      });

      this.notificationClient.emit(
        EVENT_PATTERNS.PAYMENT_PROCESSED,
        paymentEvent
      );

      return { success: true, paymentId: payment._id };
    } catch (error: any) {
      this.logger.error(
        `\n${logPrefix}\nError processing payment: ${error.message}`
      );
      throw error;
    }
  }
}
