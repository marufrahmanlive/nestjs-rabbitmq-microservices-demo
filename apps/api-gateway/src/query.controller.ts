import { Controller, Get, Param } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Order, Payment, Notification } from "@app/database";
import { AppLogger } from "@app/common";

@Controller()
export class QueryController {
  constructor(
    @InjectModel("Order") private readonly orderModel: Model<Order>,
    @InjectModel("Payment") private readonly paymentModel: Model<Payment>,
    @InjectModel("Notification")
    private readonly notificationModel: Model<Notification>,
    private readonly logger: AppLogger
  ) {}

  private get instanceId(): string {
    return process.env.INSTANCE_ID || "unknown";
  }

  /**
   * GET /orders
   * List all orders with the API Gateway instance that served the request.
   */
  @Get("orders")
  async getAllOrders() {
    const orders = await this.orderModel.find().sort({ createdAt: -1 }).lean();
    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /orders → returned ${orders.length} orders`
    );
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      count: orders.length,
      orders
    };
  }

  /**
   * GET /orders/:id
   * Get a single order by its MongoDB _id.
   */
  @Get("orders/:id")
  async getOrderById(@Param("id") id: string) {
    const order = await this.orderModel.findById(id).lean();
    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /orders/${id} → ${order ? "found" : "not found"}`
    );
    if (!order) {
      return {
        servedBy: `api-gateway-${this.instanceId}`,
        found: false,
        message: `Order with id '${id}' not found`
      };
    }
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      found: true,
      order
    };
  }

  /**
   * GET /orders/:id/payment
   * Get the payment linked to a specific order.
   */
  @Get("orders/:id/payment")
  async getPaymentByOrderId(@Param("id") orderId: string) {
    const payment = await this.paymentModel
      .findOne({ orderId })
      .sort({ createdAt: -1 })
      .lean();
    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /orders/${orderId}/payment → ${payment ? "found" : "not found"}`
    );
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      orderId,
      found: !!payment,
      payment: payment || null
    };
  }

  /**
   * GET /orders/:id/notifications
   * Get all notifications linked to a specific order (by orderId in payload).
   */
  @Get("orders/:id/notifications")
  async getNotificationsByOrderId(@Param("id") orderId: string) {
    const notifications = await this.notificationModel
      .find({ "payload.orderId": orderId })
      .sort({ createdAt: 1 })
      .lean();
    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /orders/${orderId}/notifications → ${notifications.length} found`
    );
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      orderId,
      count: notifications.length,
      notifications
    };
  }

  /**
   * GET /payments
   * List all payments.
   */
  @Get("payments")
  async getAllPayments() {
    const payments = await this.paymentModel
      .find()
      .sort({ createdAt: -1 })
      .lean();
    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /payments → returned ${payments.length} payments`
    );
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      count: payments.length,
      payments
    };
  }

  /**
   * GET /notifications
   * List all notifications.
   */
  @Get("notifications")
  async getAllNotifications() {
    const notifications = await this.notificationModel
      .find()
      .sort({ createdAt: -1 })
      .lean();
    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /notifications → returned ${notifications.length} notifications`
    );
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      count: notifications.length,
      notifications
    };
  }

  /**
   * GET /load-balance/info
   * Returns the instance ID of the API Gateway that handled the request.
   * Use this to verify Nginx → API Gateway load balancing distribution.
   */
  @Get("load-balance/info")
  getLoadBalanceInfo() {
    this.logger.log(`[API-GATEWAY-${this.instanceId}] GET /load-balance/info`);
    return {
      servedBy: `api-gateway-${this.instanceId}`,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  /**
   * GET /stats
   * Returns document counts across all collections + the gateway instance ID.
   * One-stop endpoint to verify data is being persisted by all microservices.
   */
  @Get("stats")
  async getStats() {
    const [orderCount, paymentCount, notificationCount] = await Promise.all([
      this.orderModel.countDocuments(),
      this.paymentModel.countDocuments(),
      this.notificationModel.countDocuments()
    ]);

    const stats = {
      servedBy: `api-gateway-${this.instanceId}`,
      timestamp: new Date().toISOString(),
      database: "microservices-demo",
      collections: {
        orders: orderCount,
        payments: paymentCount,
        notifications: notificationCount
      },
      eventFlow: {
        description:
          "Each order should create: 1 payment + 2 notifications (order_created + payment_processed)",
        expectedRatio: "orders : payments : notifications = 1 : 1 : 2",
        actualRatio: `${orderCount} : ${paymentCount} : ${notificationCount}`,
        healthy:
          paymentCount >= orderCount && notificationCount >= orderCount * 2
      }
    };

    this.logger.log(
      `[API-GATEWAY-${this.instanceId}] GET /stats → orders:${orderCount}, payments:${paymentCount}, notifications:${notificationCount}`
    );

    return stats;
  }
}
