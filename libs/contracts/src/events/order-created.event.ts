export class OrderCreatedEvent {
  orderId: string;
  customerId: string;
  productName: string;
  quantity: number;
  amount: number;
  createdAt: string;

  constructor(partial: Partial<OrderCreatedEvent>) {
    Object.assign(this, partial);
  }
}
