import { Controller } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  EVENT_PATTERNS,
  QUEUES,
  OrderCreatedEvent,
  PaymentProcessedEvent
} from "@app/contracts";
import { Notification } from "@app/database";
import { AppLogger, formatLogMessage } from "@app/common";

@Controller()
export class NotificationController {
  constructor(
    @InjectModel("Notification")
    private readonly notificationModel: Model<Notification>,
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
      `NOTIFICATION-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.NOTIFICATION_QUEUE,
      EVENT_PATTERNS.ORDER_CREATED
    );

    this.logger.log(
      `\n${logPrefix}\nStoring notification for order_created event: ${event.orderId}`
    );

    try {
      await this.notificationModel.create({
        eventType: EVENT_PATTERNS.ORDER_CREATED,
        payload: event,
        status: "unread"
      });

      this.logger.log(
        `\n${logPrefix}\nNotification stored for order: ${event.orderId}`
      );
    } catch (error: any) {
      this.logger.error(
        `\n${logPrefix}\nError storing notification: ${error.message}`
      );
      throw error;
    }
  }

  @EventPattern(EVENT_PATTERNS.PAYMENT_PROCESSED)
  async handlePaymentProcessed(
    @Payload() event: PaymentProcessedEvent,
    @Ctx() context: RmqContext
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const logPrefix = formatLogMessage(
      `NOTIFICATION-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.NOTIFICATION_QUEUE,
      EVENT_PATTERNS.PAYMENT_PROCESSED
    );

    this.logger.log(
      `\n${logPrefix}\nStoring notification for payment_processed event: ${event.orderId}`
    );

    try {
      await this.notificationModel.create({
        eventType: EVENT_PATTERNS.PAYMENT_PROCESSED,
        payload: event,
        status: "unread"
      });

      this.logger.log(
        `\n${logPrefix}\nNotification stored for payment: ${event.paymentId}`
      );
    } catch (error: any) {
      this.logger.error(
        `\n${logPrefix}\nError storing notification: ${error.message}`
      );
      throw error;
    }
  }
}
