import { Controller, Post, Body, Inject, Get } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { MESSAGE_PATTERNS, QUEUES, CreateOrderDto } from "@app/contracts";
import { AppLogger } from "@app/common";
import { lastValueFrom } from "rxjs";

@Controller("orders")
export class OrderController {
  constructor(
    @Inject(`${QUEUES.ORDER_QUEUE}_CLIENT`)
    private readonly orderClient: ClientProxy,
    private readonly logger: AppLogger
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
    this.logger.log(
      `[API-GATEWAY] Instance: ${process.env.INSTANCE_ID} | Queue: ${QUEUES.ORDER_QUEUE} | Pattern: ${MESSAGE_PATTERNS.CREATE_ORDER}`
    );

    return lastValueFrom(
      this.orderClient.send(MESSAGE_PATTERNS.CREATE_ORDER, dto)
    );
  }
}
