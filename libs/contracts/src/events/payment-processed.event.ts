export class PaymentProcessedEvent {
  orderId: string;
  paymentId: string;
  customerId: string;
  amount: number;
  status: "success" | "failed";
  processedAt: string;

  constructor(partial: Partial<PaymentProcessedEvent>) {
    Object.assign(this, partial);
  }
}
