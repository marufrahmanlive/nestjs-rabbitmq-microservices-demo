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
import { AppLogger, formatLogMessage, AuditLogService } from "@app/common";

@Controller()
export class OrderController {
  constructor(
    @InjectModel("Order") private readonly orderModel: Model<Order>,
    @Inject(`${QUEUES.PAYMENT_QUEUE}_CLIENT`)
    private readonly paymentClient: ClientProxy,
    @Inject(`${QUEUES.NOTIFICATION_QUEUE}_CLIENT`)
    private readonly notificationClient: ClientProxy,
    private readonly logger: AppLogger,
    private readonly auditLogService: AuditLogService
  ) {}

  @MessagePattern(MESSAGE_PATTERNS.CREATE_ORDER)
  async handleCreateOrder(
    @Payload() data: any,
    @Ctx() context: RmqContext
  ): Promise<any> {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const instanceId = process.env.INSTANCE_ID || "unknown";
    const serviceName = process.env.SERVICE_NAME || "order-service";
    const logPrefix = formatLogMessage(
      `ORDER-SERVICE-${instanceId}`,
      instanceId,
      QUEUES.ORDER_QUEUE,
      MESSAGE_PATTERNS.CREATE_ORDER
    );

    const startTime = Date.now();

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

      // Audit log: order created (MessagePattern handled)
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Order ${order._id} created for customer ${data.customerId}, amount ${data.amount}`,
        handler: MESSAGE_PATTERNS.CREATE_ORDER,
        method: "EVENT",
        url: `queue:${QUEUES.ORDER_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: data,
        responseData: { success: true, orderId: order._id.toString() },
        metadata: { orderId: order._id.toString(), eventType: "order_created" }
      });

      // Emit order_created event to payment queue (Event Pattern)
      this.paymentClient.emit(EVENT_PATTERNS.ORDER_CREATED, event);

      // Audit log: event emitted to payment queue
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Emitted ${EVENT_PATTERNS.ORDER_CREATED} event to ${QUEUES.PAYMENT_QUEUE} for order ${order._id}`,
        handler: `${EVENT_PATTERNS.ORDER_CREATED} → ${QUEUES.PAYMENT_QUEUE}`,
        method: "EMIT",
        url: `queue:${QUEUES.PAYMENT_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: event,
        metadata: {
          orderId: order._id.toString(),
          targetQueue: QUEUES.PAYMENT_QUEUE
        }
      });

      // Emit order_created event to notification queue (Event Pattern)
      this.notificationClient.emit(EVENT_PATTERNS.ORDER_CREATED, event);

      // Audit log: event emitted to notification queue
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "log",
        message: `Emitted ${EVENT_PATTERNS.ORDER_CREATED} event to ${QUEUES.NOTIFICATION_QUEUE} for order ${order._id}`,
        handler: `${EVENT_PATTERNS.ORDER_CREATED} → ${QUEUES.NOTIFICATION_QUEUE}`,
        method: "EMIT",
        url: `queue:${QUEUES.NOTIFICATION_QUEUE}`,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        requestData: event,
        metadata: {
          orderId: order._id.toString(),
          targetQueue: QUEUES.NOTIFICATION_QUEUE
        }
      });

      this.logger.log(
        `\n${logPrefix}\nOrder ${order._id} created. Emitted order_created event to payment & notification queues.`
      );

      return { success: true, orderId: order._id };
    } catch (error: any) {
      // Audit log: error
      await this.auditLogService.log({
        instanceId,
        serviceName,
        level: "error",
        message: `Failed to create order: ${error.message}`,
        handler: MESSAGE_PATTERNS.CREATE_ORDER,
        method: "EVENT",
        url: `queue:${QUEUES.ORDER_QUEUE}`,
        statusCode: error.status || 500,
        durationMs: Date.now() - startTime,
        requestData: data,
        errorStack: error.stack
      });

      this.logger.error(
        `\n${logPrefix}\nError creating order: ${error.message}`
      );
      throw error;
    }
  }
}
