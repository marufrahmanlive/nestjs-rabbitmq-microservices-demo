# NestJS RabbitMQ Microservices Demo

A production-grade microservices architecture built with **NestJS**, **RabbitMQ**, **MongoDB**, and **Nginx**, running entirely in Docker.

---

## Architecture Overview

```
                          ┌─────────────────────────────────────┐
                          │         Nginx (Port 3000)           │
                          │      Reverse Proxy + Load Balancer  │
                          │          (least_conn)               │
                          └──────┬──────────┬──────────┬────────┘
                                 │          │          │
                    ┌────────────┼──────────┼──────────┼────────────┐
                    ▼            ▼          ▼          ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  API GW  │ │  API GW  │ │  API GW  │    (3 instances)
              │  (HTTP)  │ │  (HTTP)  │ │  (HTTP)  │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   └─────┬──────┴──────┬─────┘
                         │ send(order) │
                         ▼             │
              ┌──────────────────┐     │
              │   RabbitMQ        │    │
              │  ┌─────────────┐  │    │
              │  │ order_queue │◄─┘    │
              │  ├─────────────┤       │
              │  │payment_queue│       │
              │  ├─────────────┤       │
              │  │ notif_queue │       │
              │  └─────────────┘       │
              └──┬────────┬───────────┘
                 │        │
    ┌────────────┼────────┼────────────────────┐
    ▼            ▼        ▼                    ▼
┌────────┐ ┌─────────┐ ┌──────────────┐
│ Order  │ │Payment  │ │Notification  │  (3 instances each)
│Service │ │Service  │ │  Service     │
│   ×3   │ │   ×3    │ │    ×3        │
└───┬────┘ └───┬─────┘ └──────┬───────┘
    │          │              │
    └──────────┼──────────────┘
               ▼
        ┌──────────┐
        │ MongoDB  │
        └──────────┘
```

### Event Flow (Order Creation)

```
1. Client → POST /orders (via Nginx:3000)
2. Nginx → API Gateway (load balanced, least_conn)
3. API Gateway → RabbitMQ order_queue (MessagePattern)
4. Order Service → Creates order in MongoDB
                → Emits order_created event → payment_queue + notification_queue
5. Payment Service → Creates payment in MongoDB
                   → Emits payment_processed event → notification_queue
6. Notification Service → Stores notification records in MongoDB
```

---

## Tech Stack

| Layer                | Technology              | Version               |
| -------------------- | ----------------------- | --------------------- |
| **Runtime**          | Node.js                 | 20 (Alpine)           |
| **Framework**        | NestJS                  | 10.4                  |
| **Message Broker**   | RabbitMQ                | 3 (Management Alpine) |
| **Database**         | MongoDB                 | 7                     |
| **ODM**              | Mongoose                | 8.4                   |
| **Reverse Proxy**    | Nginx                   | 1.31 (Alpine)         |
| **Containerization** | Docker + Docker Compose | 3.8+                  |
| **Logging**          | Winston                 | 3.13                  |

---

## Project Structure

```
nestjs-rabbitmq-microservices-demo/
├── apps/
│   ├── api-gateway/           # HTTP entry point (Express)
│   │   └── src/
│   │       ├── main.ts            # Bootstrap (port 3000)
│   │       ├── app.module.ts      # Imports RabbitMQ clients
│   │       └── order.controller.ts # REST endpoints
│   ├── order-service/         # Order processing microservice
│   │   └── src/
│   │       ├── main.ts            # RMQ microservice bootstrap
│   │       ├── app.module.ts      # DB + RMQ + Clients
│   │       └── order.controller.ts # create_order handler
│   ├── payment-service/       # Payment processing microservice
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       └── payment.controller.ts # order_created + process_payment
│   └── notification-service/  # Notification persistence microservice
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           └── notification.controller.ts # order_created + payment_processed
├── libs/
│   ├── common/                # Shared utilities (logger, filters, interceptors)
│   ├── contracts/             # DTOs, events, message patterns, queue names
│   ├── database/              # Mongoose schemas & DatabaseModule
│   └── rabbitmq/              # Dynamic RabbitMQ client module
├── deploy/
│   └── docker-compose.yml     # Full stack orchestration (15 containers)
├── infrastructure/
│   └── nginx/
│       └── nginx.conf         # Reverse proxy + load balancer config
├── Dockerfile                 # Multi-stage build for all services
├── .dockerignore
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (v2+)
- **Ports available**: `3000`, `5672`, `15672`, `27017`

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nestjs-rabbitmq-microservices-demo
```

### 2. Start All Services

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

This command:

- Builds all 4 microservice images (API Gateway, Order, Payment, Notification)
- Starts **15 containers**: RabbitMQ, MongoDB, Nginx, and 3 replicas of each microservice
- Waits for RabbitMQ and MongoDB health checks before starting dependent services

### 3. Verify Everything is Running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected output — all 15 containers with status `Up`:

| Container                | Count       |
| ------------------------ | ----------- |
| `nginx-lb`               | 1           |
| `api-gateway-N`          | 3           |
| `order-service-N`        | 3           |
| `payment-service-N`      | 3           |
| `notification-service-N` | 3           |
| `rabbitmq`               | 1 (healthy) |
| `mongodb`                | 1 (healthy) |

### 4. Test the System

#### Health Check (tests Nginx → API Gateway)

```bash
curl http://localhost:3000/orders/health
# {"status":"ok","instance":"api-gateway-xxxxx"}
```

#### Create an Order (end-to-end test)

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cust-001","productName":"Widget-X","quantity":2,"amount":99.99}'

# {"success":true,"orderId":"6a21b280fa0f318bcfb7ae6d"}
```

#### Verify Data in MongoDB

```bash
docker exec mongodb mongosh --quiet microservices-demo --eval "
  print('Orders:', db.orders.countDocuments());
  print('Payments:', db.payments.countDocuments());
  print('Notifications:', db.notifications.countDocuments());
"
# Orders: 1
# Payments: 1
# Notifications: 2
```

### 5. Access Management UIs

| Service                 | URL                         | Credentials       |
| ----------------------- | --------------------------- | ----------------- |
| **RabbitMQ Management** | http://localhost:15672      | `admin` / `admin` |
| **Nginx (API Gateway)** | http://localhost:3000       | —                 |
| **MongoDB**             | `mongodb://localhost:27017` | —                 |

---

## Development Mode

For local development without Docker:

### 1. Start Infrastructure Only

```bash
docker compose -f deploy/docker-compose.yml up -d rabbitmq mongodb
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Services Individually

```bash
# Start API Gateway (HTTP server on port 3000)
npm run start:dev:gateway

# Start Order Service (RMQ consumer)
npm run start:dev:order

# Start Payment Service (RMQ consumer)
npm run start:dev:payment

# Start Notification Service (RMQ consumer)
npm run start:dev:notification
```

Each service runs with `--watch` for hot-reload during development.

### 4. Environment Variables

| Variable       | Default                                        | Description                    |
| -------------- | ---------------------------------------------- | ------------------------------ |
| `RABBITMQ_URL` | `amqp://admin:admin@localhost:5672`            | RabbitMQ connection string     |
| `MONGO_URI`    | `mongodb://localhost:27017/microservices-demo` | MongoDB connection string      |
| `PORT`         | `3000`                                         | API Gateway HTTP port          |
| `SERVICE_NAME` | `api-gateway`                                  | Service name for build context |

---

## Message Patterns

### Queues

| Queue                | Type    | Consumers                 |
| -------------------- | ------- | ------------------------- |
| `order_queue`        | Durable | order-service (×3)        |
| `payment_queue`      | Durable | payment-service (×3)      |
| `notification_queue` | Durable | notification-service (×3) |

### Message Patterns (Request-Reply)

| Pattern           | Producer    | Consumer        | Payload             |
| ----------------- | ----------- | --------------- | ------------------- |
| `create_order`    | API Gateway | Order Service   | `CreateOrderDto`    |
| `process_payment` | (Manual)    | Payment Service | `ProcessPaymentDto` |

### Event Patterns (Fire-and-Forget)

| Pattern             | Producer        | Consumers                             |
| ------------------- | --------------- | ------------------------------------- |
| `order_created`     | Order Service   | Payment Service, Notification Service |
| `payment_processed` | Payment Service | Notification Service                  |

---

## Nginx Configuration

Nginx listens on **port 3000** and load balances across 3 API Gateway instances using `least_conn` algorithm:

```
upstream api_gateway_pool {
    least_conn;
    server api-gateway-1:3000;
    server api-gateway-2:3000;
    server api-gateway-3:3000;
    keepalive 32;
}
```

### Load Balancing Verification

```bash
for i in {1..6}; do curl -s http://localhost:3000/orders/health | grep instance; done
# api-gateway-3349c03a
# api-gateway-51bc9258
# api-gateway-e93ed9ad
# api-gateway-3349c03a
# api-gateway-51bc9258
# api-gateway-e93ed9ad
```

---

## MongoDB Collections

| Collection      | Schema Fields                                                        | Populated By         |
| --------------- | -------------------------------------------------------------------- | -------------------- |
| `orders`        | `customerId`, `productName`, `quantity`, `amount`, `status`, `notes` | Order Service        |
| `payments`      | `orderId`, `customerId`, `amount`, `status`                          | Payment Service      |
| `notifications` | `eventType`, `payload`, `status`                                     | Notification Service |

---

## Docker Compose Services

| Service                | Instances | Ports            | Dependencies      |
| ---------------------- | --------- | ---------------- | ----------------- |
| `mongodb`              | 1         | `27017`          | —                 |
| `rabbitmq`             | 1         | `5672`, `15672`  | —                 |
| `api-gateway`          | 3         | internal: `3000` | rabbitmq          |
| `order-service`        | 3         | —                | rabbitmq, mongodb |
| `payment-service`      | 3         | —                | rabbitmq, mongodb |
| `notification-service` | 3         | —                | rabbitmq, mongodb |
| `nginx`                | 1         | `3000:3000`      | api-gateway ×3    |

---

## Commands Reference

| Action                     | Command                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| Start all services         | `docker compose -f deploy/docker-compose.yml up -d --build`               |
| Stop all services          | `docker compose -f deploy/docker-compose.yml down`                        |
| View logs                  | `docker compose -f deploy/docker-compose.yml logs -f`                     |
| View specific service logs | `docker logs api-gateway-1 --tail 50`                                     |
| Check container status     | `docker ps --format "table {{.Names}}\t{{.Status}}"`                      |
| Rebuild a single service   | `docker compose -f deploy/docker-compose.yml up -d --build api-gateway-1` |
| Access MongoDB shell       | `docker exec -it mongodb mongosh microservices-demo`                      |
| RabbitMQ queues info       | `curl -u admin:admin http://localhost:15672/api/queues`                   |

---

## Troubleshooting

### Port Conflicts

Ensure ports `3000`, `5672`, `15672`, and `27017` are not in use by other applications.

### RabbitMQ Connection Issues

If services restart repeatedly, check the RabbitMQ logs:

```bash
docker logs rabbitmq --tail 30
```

### MongoDB Connection Issues

Verify MongoDB is healthy before dependent services start:

```bash
docker exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### View Service Logs

```bash
# API Gateway
docker logs api-gateway-1 --tail 20

# Order Service
docker logs order-service-1 --tail 20

# Payment Service
docker logs payment-service-1 --tail 20

# Notification Service
docker logs notification-service-1 --tail 20
```

---

## License

MIT
