import { Controller, Post, Body, Inject, Get } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { MESSAGE_PATTERNS, QUEUES, CreateOrderDto } from "@app/contracts";
import { AppLogger, AuditLogService } from "@app/common";
import { lastValueFrom } from "rxjs";

@Controller("orders")
export class OrderController {
  constructor(
    @Inject(`${QUEUES.ORDER_QUEUE}_CLIENT`)
    private readonly orderClient: ClientProxy,
    private readonly logger: AppLogger,
    private readonly auditLogService: AuditLogService
  ) {}

  @Get("health")
  health(): { status: string; instance: string } {
    return {
      status: "ok",
      instance: process.env.INSTANCE_ID || "unknown"
    };
  }

  @Post()
  async createOrder(@Body() dto: CreateOrderDto): Promise<any> {
    const instanceId = process.env.INSTANCE_ID || "unknown";
    const serviceName = process.env.SERVICE_NAME || "api-gateway";
    const startTime = Date.now();

    this.logger.log(
      `[API-GATEWAY] Instance: ${instanceId} | Queue: ${QUEUES.ORDER_QUEUE} | Pattern: ${MESSAGE_PATTERNS.CREATE_ORDER}`
    );

    // Audit log: sending create_order message to order-service
    await this.auditLogService.log({
      instanceId,
      serviceName,
      level: "log",
      message: `Sending ${MESSAGE_PATTERNS.CREATE_ORDER} to ${QUEUES.ORDER_QUEUE} for customer ${dto.customerId}`,
      handler: `POST /orders → ${MESSAGE_PATTERNS.CREATE_ORDER}`,
      method: "SEND",
      url: `queue:${QUEUES.ORDER_QUEUE}`,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      requestData: dto,
      metadata: {
        targetQueue: QUEUES.ORDER_QUEUE,
        pattern: MESSAGE_PATTERNS.CREATE_ORDER
      }
    });

    return lastValueFrom(
      this.orderClient.send(MESSAGE_PATTERNS.CREATE_ORDER, dto)
    );
  }
}
