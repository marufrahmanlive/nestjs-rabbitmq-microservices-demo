export const MESSAGE_PATTERNS = {
  CREATE_ORDER: "create_order",
  PROCESS_PAYMENT: "process_payment"
} as const;

export const EVENT_PATTERNS = {
  ORDER_CREATED: "order_created",
  PAYMENT_PROCESSED: "payment_processed"
} as const;

export const QUEUES = {
  ORDER_QUEUE: "order_queue",
  PAYMENT_QUEUE: "payment_queue",
  NOTIFICATION_QUEUE: "notification_queue"
} as const;
