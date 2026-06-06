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
import { AppLogger, formatLogMessage, AuditLogService } from "@app/common";

@Controller()
export class NotificationController {
  constructor(
    @InjectModel("Notification")
    private readonly notificationModel: Model<Notification>,
    private readonly logger: AppLogger,
    private readonly auditLogService: AuditLogService
  ) {}

  @EventPattern(EVENT_PATTERNS.ORDER_CREATED)
  async handleOrderCreated(
    @Payload() event: OrderCreatedEvent,
    @Ctx() context: RmqContext
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const serviceName = process.env.SERVICE_NAME || "notification-service";
    const logPrefix = formatLogMessage(
      `NOTIFICATION-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.NOTIFICATION_QUEUE,
      EVENT_PATTERNS.ORDER_CREATED
    );

    const startTime = Date.now();

    this.logger.log(
      `\n${logPrefix}\nStoring notification for order_created event: ${event.orderId}`
    );

    try {
      const notification = await this.notificationModel.create({
        eventType: EVENT_PATTERNS.ORDER_CREATED,
        payload: event,
        status: "unread"
      });

      // Audit log: received order_created event & stored notification
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Notification stored for order_created event: order ${event.orderId}`,
        handler: `${EVENT_PATTERNS.ORDER_CREATED} (received)`,
        method: "EVENT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: event,
        responseData: {
          notificationId: notification._id.toString(),
          eventType: EVENT_PATTERNS.ORDER_CREATED
        },
        metadata: {
          orderId: event.orderId,
          eventType: EVENT_PATTERNS.ORDER_CREATED
        }
      });

      this.logger.log(
        `\n${logPrefix}\nNotification stored for order: ${event.orderId}`
      );
    } catch (error: any) {
      // Audit log: error
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "error",
        message: `Failed to store notification for order_created event: ${error.message}`,
        handler: `${EVENT_PATTERNS.ORDER_CREATED} (received)`,
        method: "EVENT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: error.status || 500,
        durationMs: Date.now() - startTime,
        requestData: event,
        errorStack: error.stack
      });

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
    const serviceName = process.env.SERVICE_NAME || "notification-service";
    const logPrefix = formatLogMessage(
      `NOTIFICATION-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.NOTIFICATION_QUEUE,
      EVENT_PATTERNS.PAYMENT_PROCESSED
    );

    const startTime = Date.now();

    this.logger.log(
      `\n${logPrefix}\nStoring notification for payment_processed event: ${event.orderId}`
    );

    try {
      const notification = await this.notificationModel.create({
        eventType: EVENT_PATTERNS.PAYMENT_PROCESSED,
        payload: event,
        status: "unread"
      });

      // Audit log: received payment_processed event & stored notification
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Notification stored for payment_processed event: order ${event.orderId}, payment ${event.paymentId}`,
        handler: `${EVENT_PATTERNS.PAYMENT_PROCESSED} (received)`,
        method: "EVENT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: event,
        responseData: {
          notificationId: notification._id.toString(),
          eventType: EVENT_PATTERNS.PAYMENT_PROCESSED
        },
        metadata: {
          orderId: event.orderId,
          paymentId: event.paymentId,
          eventType: EVENT_PATTERNS.PAYMENT_PROCESSED
        }
      });

      this.logger.log(
        `\n${logPrefix}\nNotification stored for payment: ${event.paymentId}`
      );
    } catch (error: any) {
      // Audit log: error
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "error",
        message: `Failed to store notification for payment_processed event: ${error.message}`,
        handler: `${EVENT_PATTERNS.PAYMENT_PROCESSED} (received)`,
        method: "EVENT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: error.status || 500,
        durationMs: Date.now() - startTime,
        requestData: event,
        errorStack: error.stack
      });

      this.logger.error(
        `\n${logPrefix}\nError storing notification: ${error.message}`
      );
      throw error;
    }
  }
}
