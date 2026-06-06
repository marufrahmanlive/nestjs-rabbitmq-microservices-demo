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
import { AppLogger, formatLogMessage, AuditLogService } from "@app/common";

@Controller()
export class PaymentController {
  constructor(
    @InjectModel("Payment") private readonly paymentModel: Model<Payment>,
    @Inject(`${QUEUES.NOTIFICATION_QUEUE}_CLIENT`)
    private readonly notificationClient: ClientProxy,
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
    const serviceName = process.env.SERVICE_NAME || "payment-service";
    const logPrefix = formatLogMessage(
      `PAYMENT-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.PAYMENT_QUEUE,
      EVENT_PATTERNS.ORDER_CREATED
    );

    const startTime = Date.now();

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

      // Audit log: received order_created event & payment processed
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Payment ${payment._id} completed for order ${event.orderId}, amount ${event.amount}`,
        handler: `${EVENT_PATTERNS.ORDER_CREATED} (received)`,
        method: "EVENT",
        url: `queue:${QUEUES.PAYMENT_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: event,
        responseData: {
          paymentId: payment._id.toString(),
          status: "completed"
        },
        metadata: { orderId: event.orderId, paymentId: payment._id.toString() }
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

      // Audit log: event emitted to notification queue
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Emitted ${EVENT_PATTERNS.PAYMENT_PROCESSED} event to ${QUEUES.NOTIFICATION_QUEUE} for payment ${payment._id}`,
        handler: `${EVENT_PATTERNS.PAYMENT_PROCESSED} → ${QUEUES.NOTIFICATION_QUEUE}`,
        method: "EMIT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: paymentEvent,
        metadata: {
          orderId: event.orderId,
          paymentId: payment._id.toString(),
          targetQueue: QUEUES.NOTIFICATION_QUEUE
        }
      });

      this.logger.log(
        `\n${logPrefix}\nPayment ${payment._id} processed for order ${event.orderId}. Emitted payment_processed event.`
      );
    } catch (error: any) {
      // Audit log: error
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "error",
        message: `Failed to auto-process payment for order ${event.orderId}: ${error.message}`,
        handler: `${EVENT_PATTERNS.ORDER_CREATED} (received)`,
        method: "EVENT",
        url: `queue:${QUEUES.PAYMENT_QUEUE}`,
        statusCode: error.status || 500,
        durationMs: Date.now() - startTime,
        requestData: event,
        errorStack: error.stack
      });

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
    const serviceName = process.env.SERVICE_NAME || "payment-service";
    const logPrefix = formatLogMessage(
      `PAYMENT-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.PAYMENT_QUEUE,
      MESSAGE_PATTERNS.PROCESS_PAYMENT
    );

    const startTime = Date.now();

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

      // Audit log: manual payment processed (MessagePattern handled)
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Manual payment ${payment._id} completed for order ${data.orderId}, amount ${data.amount}`,
        handler: MESSAGE_PATTERNS.PROCESS_PAYMENT,
        method: "EVENT",
        url: `queue:${QUEUES.PAYMENT_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: data,
        responseData: { success: true, paymentId: payment._id.toString() },
        metadata: { orderId: data.orderId, paymentId: payment._id.toString() }
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

      // Audit log: event emitted to notification queue
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Emitted ${EVENT_PATTERNS.PAYMENT_PROCESSED} event to ${QUEUES.NOTIFICATION_QUEUE} for payment ${payment._id}`,
        handler: `${EVENT_PATTERNS.PAYMENT_PROCESSED} → ${QUEUES.NOTIFICATION_QUEUE}`,
        method: "EMIT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: paymentEvent,
        metadata: {
          orderId: data.orderId,
          paymentId: payment._id.toString(),
          targetQueue: QUEUES.NOTIFICATION_QUEUE
        }
      });

      return { success: true, paymentId: payment._id };
    } catch (error: any) {
      // Audit log: error
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "error",
        message: `Failed to manually process payment for order ${data.orderId}: ${error.message}`,
        handler: MESSAGE_PATTERNS.PROCESS_PAYMENT,
        method: "EVENT",
        url: `queue:${QUEUES.PAYMENT_QUEUE}`,
        statusCode: error.status || 500,
        durationMs: Date.now() - startTime,
        requestData: data,
        errorStack: error.stack
      });

      this.logger.error(
        `\n${logPrefix}\nError processing payment: ${error.message}`
      );
      throw error;
    }
  }
}
