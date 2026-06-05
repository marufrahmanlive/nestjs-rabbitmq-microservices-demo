# NestJS RabbitMQ Microservices Demo

A production-grade microservices architecture built with **NestJS**, **RabbitMQ**, **MongoDB**, and **Nginx**, running entirely in Docker.

---

## Architecture Overview

```
                          ┌─────────────────────────────────────┐
                          │         Nginx (Port 3000)           │
                          │      Reverse Proxy + Load Balancer  │
                          │    (Docker DNS resolver / VIP)      │
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
2. Nginx → API Gateway (load balanced via Docker VIP)
3. API Gateway → RabbitMQ order_queue (MessagePattern)
4. Order Service → Creates order in MongoDB
                → Emits order_created event → payment_queue + notification_queue
5. Payment Service → Creates payment in MongoDB
                   → Emits payment_processed event → notification_queue
6. Notification Service → Stores notification records in MongoDB
```

---

## Tech Stack

| Layer                | Technology                             | Version               |
| -------------------- | -------------------------------------- | --------------------- |
| **Runtime**          | Node.js                                | 20 (Alpine)           |
| **Framework**        | NestJS                                 | 10.4                  |
| **Message Broker**   | RabbitMQ                               | 3 (Management Alpine) |
| **Database**         | MongoDB                                | 7                     |
| **ODM**              | Mongoose                               | 8.4                   |
| **Reverse Proxy**    | Nginx                                  | 1.31 (Alpine)         |
| **Containerization** | Docker + Docker Compose + Docker Swarm | 3.8+ / 27+            |
| **Logging**          | Winston                                | 3.13                  |

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
│   ├── docker-compose.yml       # Docker Compose orchestration (15 containers)
│   └── docker-compose.swarm.yml # Docker Swarm stack (rolling updates, replicas)
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

## Quick Start (Docker Compose)

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

### 4. Test All Endpoints

> **Tip:** You can also use the provided `requests.http` file with VS Code's [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension for one-click testing.

#### 4.1 Health Check

Tests Nginx → API Gateway connectivity. Since Nginx load balances across 3 API Gateway replicas, repeated requests will show different instance IDs.

**Endpoint:** `GET /orders/health`

```bash
curl http://localhost:3000/orders/health
# {"status":"ok","instance":"api-gateway-xxxxx"}

# Verify load balancing across all 3 instances
for i in {1..6}; do curl -s http://localhost:3000/orders/health | grep instance; done
```

**Sample Response:**

```json
{
  "status": "ok",
  "instance": "api-gateway-ab12cd34"
}
```

#### 4.2 Create an Order (End-to-End Event Flow)

Creates an order via API Gateway → RabbitMQ → Order Service → MongoDB. This triggers the full event chain: `order_created` event → Payment Service + Notification Service, then `payment_processed` event → Notification Service.

**Endpoint:** `POST /orders`

| Field         | Type   | Required | Constraints | Description          |
| ------------- | ------ | -------- | ----------- | -------------------- |
| `customerId`  | string | Yes      | —           | Customer identifier  |
| `productName` | string | Yes      | —           | Name of the product  |
| `quantity`    | number | Yes      | ≥ 1         | Order quantity       |
| `amount`      | number | Yes      | ≥ 0         | Total order amount   |
| `notes`       | string | No       | —           | Optional order notes |

**Sample Request 1 — Basic Order:**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-001",
    "productName": "Widget-X",
    "quantity": 2,
    "amount": 99.99
  }'
```

**Sample Response:**

```json
{
  "success": true,
  "orderId": "6a21b280fa0f318bcfb7ae6d"
}
```

**Sample Request 2 — Order with Notes:**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-002",
    "productName": "Gadget-Y",
    "quantity": 1,
    "amount": 49.50,
    "notes": "Gift wrap please"
  }'
```

**Sample Request 3 — High-Value Order:**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-003",
    "productName": "Enterprise-Server",
    "quantity": 5,
    "amount": 15000.00
  }'
```

**Sample Request 4 — Multiple Orders (Load Test):**

```bash
# Send 10 orders to observe load balancing across all services
for i in $(seq 1 10); do
  curl -s -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{\"customerId\":\"cust-$i\",\"productName\":\"Item-$i\",\"quantity\":$i,\"amount\":$((i * 10)).00}" &
done
wait
```

#### 4.3 Verify Data in MongoDB

After creating orders, verify that all services persisted data correctly in their respective collections.

```bash
# Count documents across all collections
docker exec mongodb mongosh --quiet microservices-demo --eval "
  print('Orders:', db.orders.countDocuments());
  print('Payments:', db.payments.countDocuments());
  print('Notifications:', db.notifications.countDocuments());
"
# Orders: 1
# Payments: 1
# Notifications: 2
```

**Expected results after creating 1 order:**

- **Orders:** 1 (created by Order Service)
- **Payments:** 1 (created by Payment Service after `order_created` event)
- **Notifications:** 2 (one for `order_created` event, one for `payment_processed` event)

**Inspect individual documents:**

```bash
# View a sample order
docker exec mongodb mongosh --quiet microservices-demo --eval "
  printjson(db.orders.findOne())
"

# View a sample payment
docker exec mongodb mongosh --quiet microservices-demo --eval "
  printjson(db.payments.findOne())
"

# View all notifications
docker exec mongodb mongosh --quiet microservices-demo --eval "
  db.notifications.find().forEach(printjson)
"
```

**Sample Order Document:**

```json
{
  "_id": "ObjectId('6a21b280fa0f318bcfb7ae6d')",
  "customerId": "cust-001",
  "productName": "Widget-X",
  "quantity": 2,
  "amount": 99.99,
  "status": "created",
  "notes": null,
  "createdAt": "2025-06-05T12:00:00.000Z",
  "updatedAt": "2025-06-05T12:00:00.000Z"
}
```

**Sample Payment Document:**

```json
{
  "_id": "ObjectId('...')",
  "orderId": "6a21b280fa0f318bcfb7ae6d",
  "customerId": "cust-001",
  "amount": 99.99,
  "status": "completed",
  "createdAt": "2025-06-05T12:00:01.000Z",
  "updatedAt": "2025-06-05T12:00:01.000Z"
}
```

**Sample Notification Documents:**

```json
{
  "_id": "ObjectId('...')",
  "eventType": "order_created",
  "payload": {
    "orderId": "6a21b280fa0f318bcfb7ae6d",
    "customerId": "cust-001",
    "productName": "Widget-X",
    "quantity": 2,
    "amount": 99.99
  },
  "status": "sent",
  "createdAt": "2025-06-05T12:00:00.000Z"
}
```

```json
{
  "_id": "ObjectId('...')",
  "eventType": "payment_processed",
  "payload": {
    "orderId": "6a21b280fa0f318bcfb7ae6d",
    "customerId": "cust-001",
    "amount": 99.99
  },
  "status": "sent",
  "createdAt": "2025-06-05T12:00:01.000Z"
}
```

#### 4.4 Verify RabbitMQ Queues

Check message broker queues and message counts.

```bash
# List all queues with message counts
curl -u admin:admin http://localhost:15672/api/queues | python -m json.tool

# Or use the dedicated queue endpoint
curl -u admin:admin http://localhost:15672/api/queues/%2F/order_queue
curl -u admin:admin http://localhost:15672/api/queues/%2F/payment_queue
curl -u admin:admin http://localhost:15672/api/queues/%2F/notification_queue
```

#### 4.5 Public Query Endpoints

The API Gateway now exposes query endpoints that read directly from MongoDB, so you can verify the data produced by all services without connecting to MongoDB directly. Each response includes a `servedBy` field showing which API Gateway instance handled the request.

| Endpoint                    | Method | Description                                                   |
| --------------------------- | ------ | ------------------------------------------------------------- |
| `/stats`                    | GET    | Document counts across all collections + event flow health    |
| `/load-balance/info`        | GET    | Instance ID, timestamp, and uptime of the serving API Gateway |
| `/orders`                   | GET    | List all orders (sorted by newest first)                      |
| `/orders/:id`               | GET    | Get a single order by its MongoDB `_id`                       |
| `/orders/:id/payment`       | GET    | Get the payment linked to a specific order                    |
| `/orders/:id/notifications` | GET    | Get all notifications linked to a specific order              |
| `/payments`                 | GET    | List all payments                                             |
| `/notifications`            | GET    | List all notifications                                        |

**Stats Dashboard:**

```bash
curl http://localhost:3000/stats | python -m json.tool
```

**Sample Response:**

```json
{
  "servedBy": "api-gateway-ab12cd34",
  "timestamp": "2025-06-05T12:01:00.000Z",
  "database": "microservices-demo",
  "collections": {
    "orders": 3,
    "payments": 3,
    "notifications": 6
  },
  "eventFlow": {
    "description": "Each order should create: 1 payment + 2 notifications (order_created + payment_processed)",
    "expectedRatio": "orders : payments : notifications = 1 : 1 : 2",
    "actualRatio": "3 : 3 : 6",
    "healthy": true
  }
}
```

**Get Order with Payment and Notifications (full trace):**

```bash
# 1. Create an order and capture the orderId
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"trace-001","productName":"TraceWidget","quantity":1,"amount":19.99}')
ORDER_ID=$(echo "$ORDER_RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['orderId'])")
echo "Order ID: $ORDER_ID"

# 2. Wait for async processing
sleep 3

# 3. Get the order
curl -s "http://localhost:3000/orders/$ORDER_ID" | python -m json.tool

# 4. Get the payment for this order
curl -s "http://localhost:3000/orders/$ORDER_ID/payment" | python -m json.tool

# 5. Get notifications for this order
curl -s "http://localhost:3000/orders/$ORDER_ID/notifications" | python -m json.tool
```

#### 4.6 Verify Load Balancing & Instance-ID Logging

Each microservice logs its `INSTANCE_ID` on every operation. Use the commands below to verify requests are distributed across all replicas at every layer and that logs carry the correct instance identifiers.

---

**Layer 1: Nginx → API Gateway**

The API Gateway assigns a unique `INSTANCE_ID` (e.g., `api-gateway-ab12cd34`) at startup. Hit the `/load-balance/info` endpoint repeatedly to confirm Nginx distributes requests across all 3 replicas.

```bash
# Send 30 requests and count unique instance IDs (Bash / Git Bash)
for i in $(seq 1 30); do
  curl -s http://localhost:3000/load-balance/info | python -c "import sys,json; print(json.load(sys.stdin)['servedBy'])"
done | sort | uniq -c

# PowerShell equivalent
1..30 | ForEach-Object {
  (Invoke-RestMethod http://localhost:3000/load-balance/info).servedBy
} | Group-Object | Select-Object Count, Name
```

**Expected:** 3 unique instance IDs, roughly even distribution (e.g., ~10/10/10 for 30 requests).

---

**Layer 2: RabbitMQ → Order Service**

Each order-service instance logs messages with its instance ID. Send orders and check logs to see which instances processed them.

```bash
# First, send 10 orders
for i in $(seq 1 10); do
  curl -s -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{\"customerId\":\"lb-test-$i\",\"productName\":\"LoadTest\",\"quantity\":1,\"amount\":9.99}" > /dev/null
done

sleep 2

# Check logs from all 3 order-service replicas
echo "=== Order Service 1 ==="
docker logs order-service-1 2>&1 | tail -5

echo -e "\n=== Order Service 2 ==="
docker logs order-service-2 2>&1 | tail -5

echo -e "\n=== Order Service 3 ==="
docker logs order-service-3 2>&1 | tail -5

# Count how many orders each instance processed (Docker Compose)
echo -e "\n=== Order Distribution ==="
echo -n "order-service-1: "; docker logs order-service-1 2>&1 | grep -c "ORDER-SERVICE"
echo -n "order-service-2: "; docker logs order-service-2 2>&1 | grep -c "ORDER-SERVICE"
echo -n "order-service-3: "; docker logs order-service-3 2>&1 | grep -c "ORDER-SERVICE"
```

**Log output example** (note the INSTANCE_ID in the log prefix):

```
[ORDER-SERVICE-0d7adad1e4] [{instance:0d7adad1e4}][{queue:order_queue}][{pattern:create_order}]
Processing order: {"customerId":"lb-test-1",...}
```

---

**Layer 3: RabbitMQ → Payment Service**

Each payment-service instance logs its instance ID when processing `order_created` events.

```bash
echo "=== Payment Service 1 ==="
docker logs payment-service-1 2>&1 | tail -5

echo -e "\n=== Payment Service 2 ==="
docker logs payment-service-2 2>&1 | tail -5

echo -e "\n=== Payment Service 3 ==="
docker logs payment-service-3 2>&1 | tail -5

# Count payments processed per instance
echo -e "\n=== Payment Distribution ==="
echo -n "payment-service-1: "; docker logs payment-service-1 2>&1 | grep -c "PAYMENT-SERVICE"
echo -n "payment-service-2: "; docker logs payment-service-2 2>&1 | grep -c "PAYMENT-SERVICE"
echo -n "payment-service-3: "; docker logs payment-service-3 2>&1 | grep -c "PAYMENT-SERVICE"
```

---

**Layer 4: RabbitMQ → Notification Service**

Each notification-service instance logs its instance ID when processing both `order_created` and `payment_processed` events.

```bash
echo "=== Notification Service 1 ==="
docker logs notification-service-1 2>&1 | tail -5

echo -e "\n=== Notification Service 2 ==="
docker logs notification-service-2 2>&1 | tail -5

echo -e "\n=== Notification Service 3 ==="
docker logs notification-service-3 2>&1 | tail -5

# Count notifications processed per instance
echo -e "\n=== Notification Distribution ==="
echo -n "notification-service-1: "; docker logs notification-service-1 2>&1 | grep -c "NOTIFICATION-SERVICE"
echo -n "notification-service-2: "; docker logs notification-service-2 2>&1 | grep -c "NOTIFICATION-SERVICE"
echo -n "notification-service-3: "; docker logs notification-service-3 2>&1 | grep -c "NOTIFICATION-SERVICE"
```

---

**Layer 5: MongoDB — Verify Data Persistence via API**

Use the `/stats` endpoint to confirm data is persisted across all 3 MongoDB collections:

```bash
curl -s http://localhost:3000/stats | python -m json.tool
```

Or query individual collections via the public API:

```bash
# List all orders
curl -s http://localhost:3000/orders | python -c "import sys,json; d=json.load(sys.stdin); print(f'Total orders: {d[\"count\"]}')"

# List all payments
curl -s http://localhost:3000/payments | python -c "import sys,json; d=json.load(sys.stdin); print(f'Total payments: {d[\"count\"]}')"

# List all notifications
curl -s http://localhost:3000/notifications | python -c "import sys,json; d=json.load(sys.stdin); print(f'Total notifications: {d[\"count\"]}')"
```

**Load Balancing Verification Summary:**

| Layer                           | Verification Method                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| Nginx → API Gateway             | `GET /load-balance/info` × 30 → count unique `servedBy` values                           |
| RabbitMQ → Order Service        | Check `docker logs order-service-{1,2,3}` for `ORDER-SERVICE-{instanceId}` log prefix    |
| RabbitMQ → Payment Service      | Check `docker logs payment-service-{1,2,3}` for `PAYMENT-SERVICE-{instanceId}` prefix    |
| RabbitMQ → Notification Service | Check `docker logs notification-service-{1,2,3}` for `NOTIFICATION-SERVICE-{instanceId}` |
| MongoDB (data persistence)      | `GET /stats` → verify `orders >= 1`, `payments >= orders`, `notifications >= orders*2`   |

#### 4.6 Error Cases

**Missing Required Fields (Validation Error):**

```bash
# Missing productName
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cust-004","quantity":1,"amount":10.00}'

# Expected: 400 Bad Request with validation error details
```

**Invalid Quantity (Min Constraint):**

```bash
# quantity must be >= 1
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cust-005","productName":"Widget","quantity":0,"amount":10.00}'

# Expected: 400 Bad Request
```

**Invalid Amount (Negative Value):**

```bash
# amount must be >= 0
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cust-006","productName":"Widget","quantity":1,"amount":-5.00}'

# Expected: 400 Bad Request
```

#### 4.7 Complete Test Script

Run this script to perform a full end-to-end smoke test:

```bash
#!/bin/bash
# smoke-test.sh — Full end-to-end verification

set -e
BASE_URL="http://localhost:3000"

echo "=== 1. Health Check ==="
curl -s "$BASE_URL/orders/health" | python -m json.tool

echo -e "\n=== 2. Create Order ==="
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"smoke-test","productName":"SmokeWidget","quantity":3,"amount":29.97}')
echo "$ORDER_RESPONSE" | python -m json.tool
ORDER_ID=$(echo "$ORDER_RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['orderId'])")
echo "Order ID: $ORDER_ID"

echo -e "\n=== 3. Wait for async processing (3 seconds) ==="
sleep 3

echo -e "\n=== 4. Verify MongoDB Collections ==="
docker exec mongodb mongosh --quiet microservices-demo --eval "
  print('Orders: ' + db.orders.countDocuments());
  print('Payments: ' + db.payments.countDocuments());
  print('Notifications: ' + db.notifications.countDocuments());
"

echo -e "\n=== 5. Verify RabbitMQ Queues ==="
curl -s -u admin:admin http://localhost:15672/api/queues/%2F/order_queue | python -c "import sys,json; q=json.load(sys.stdin); print(f'order_queue: {q[\"messages\"]} messages')"
curl -s -u admin:admin http://localhost:15672/api/queues/%2F/payment_queue | python -c "import sys,json; q=json.load(sys.stdin); print(f'payment_queue: {q[\"messages\"]} messages')"
curl -s -u admin:admin http://localhost:15672/api/queues/%2F/notification_queue | python -c "import sys,json; q=json.load(sys.stdin); print(f'notification_queue: {q[\"messages\"]} messages')"

echo -e "\n=== Smoke Test Complete ==="
```

Save as `smoke-test.sh` and run:

```bash
chmod +x smoke-test.sh
./smoke-test.sh
```

### 5. Access Management UIs

| Service                 | URL                         | Credentials       |
| ----------------------- | --------------------------- | ----------------- |
| **RabbitMQ Management** | http://localhost:15672      | `admin` / `admin` |
| **Nginx (API Gateway)** | http://localhost:3000       | —                 |
| **MongoDB**             | `mongodb://localhost:27017` | —                 |

---

## Docker Swarm Deployment

For production-grade deployments with **rolling updates**, **resource constraints**, and **orchestrated replica management**, use Docker Swarm.

### 1. Initialize Docker Swarm

```bash
# Initialize a single-node swarm (manager)
docker swarm init

# (Optional) To add worker nodes, run the join command shown after init
```

### 2. Build Service Images

```bash
docker build --build-arg SERVICE_NAME=api-gateway -t microservices/api-gateway:latest .
docker build --build-arg SERVICE_NAME=order-service -t microservices/order-service:latest .
docker build --build-arg SERVICE_NAME=payment-service -t microservices/payment-service:latest .
docker build --build-arg SERVICE_NAME=notification-service -t microservices/notification-service:latest .
```

### 3. Deploy the Stack

```bash
docker stack deploy -c deploy/docker-compose.swarm.yml microservices
```

This deploys 7 services across the swarm:

| Service                | Replicas | Ports            | Resources (limit) |
| ---------------------- | -------- | ---------------- | ----------------- |
| `mongodb`              | 1        | `27017` (host)   | 512 MB            |
| `rabbitmq`             | 1        | `5672`, `15672`  | 512 MB            |
| `api-gateway`          | 3        | internal: `3000` | 256 MB            |
| `order-service`        | 3        | —                | 256 MB            |
| `payment-service`      | 3        | —                | 256 MB            |
| `notification-service` | 3        | —                | 256 MB            |
| `nginx`                | 1        | `3000:3000`      | 128 MB            |

### 4. Monitor Deployment

```bash
# View all services
docker stack services microservices

# View individual service tasks (replicas)
docker stack ps microservices

# View logs for a specific service
docker service logs microservices_order-service --tail 50

# View logs for all services
docker service logs microservices_api-gateway microservices_order-service microservices_payment-service microservices_notification-service
```

### 5. Rolling Updates

The swarm stack is configured with rolling updates (1 at a time, 10s delay, auto-rollback on failure). To update services:

```bash
# Rebuild images with changes
docker build --build-arg SERVICE_NAME=api-gateway -t microservices/api-gateway:latest .

# Update the service (rolling, zero-downtime)
docker service update --image microservices/api-gateway:latest microservices_api-gateway
```

### 6. Scale Services

```bash
# Scale up/down any service
docker service scale microservices_order-service=5
docker service scale microservices_payment-service=5
```

### 7. Tear Down

```bash
# Remove the entire stack
docker stack rm microservices

# Leave swarm mode (if no longer needed)
docker swarm leave --force
```

---

## Load Balancing Architecture

### Docker Compose (Static Upstream)

Nginx resolves named containers (`api-gateway-1`, `api-gateway-2`, `api-gateway-3`) at startup via the Docker DNS bridge:

```nginx
upstream api_gateway_pool {
    least_conn;
    server api-gateway-1:3000;
    server api-gateway-2:3000;
    server api-gateway-3:3000;
    keepalive 32;
}
```

### Docker Swarm (DNS Resolver + VIP)

A static `upstream` block in Swarm caches the VIP, routing all traffic to a single replica. To fix this, we use Docker's embedded DNS resolver (`127.0.0.11`) with a variable-based `proxy_pass`, forcing re-resolution on every request:

```nginx
server {
    listen 3000;
    resolver 127.0.0.11 valid=10s ipv6=off;

    location / {
        set $api_gateway "api-gateway:3000";
        proxy_pass http://$api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health {
        set $api_gateway_health "api-gateway:3000";
        proxy_pass http://$api_gateway_health/orders/health;
        proxy_set_header Host $host;
    }
}
```

This leverages Docker Swarm's built-in VIP round-robin distribution across all API Gateway replicas.

### RabbitMQ Load Balancing

For **message patterns** (request-reply), RabbitMQ uses work-queue semantics — each message is delivered to **exactly one** consumer in the queue, naturally distributing load across all 3 order-service replicas.

For **event patterns** (pub/sub), RabbitMQ fanout exchanges deliver each event to **all** subscribing queues, with each queue's consumers competing via work-queue distribution across 3 replicas.

### Load Balancing Verification

```bash
# Docker Compose (all 3 API Gateway instances should appear)
for i in {1..6}; do curl -s http://localhost:3000/orders/health | grep instance; done

# Docker Swarm (PowerShell — 50 requests to verify distribution)
1..50 | ForEach-Object { curl.exe -s http://localhost:3000/health }

# Expected result (example from verified deployment):
# api-gateway-2c64a6ba : 16 requests (32%)
# api-gateway-9a54bf2d : 17 requests (34%)
# api-gateway-da586eba : 17 requests (34%)
```

**Verified distribution across all layers (30-order test):**

| Layer                           | Instances Used | Distribution |
| ------------------------------- | -------------- | ------------ |
| Nginx → API Gateway             | 3/3 ✓          | 16 / 17 / 17 |
| RabbitMQ → Order Service        | 3/3 ✓          | 17 / 17 / 17 |
| RabbitMQ → Payment Service      | 3/3 ✓          | 17 / 17 / 17 |
| RabbitMQ → Notification Service | 3/3 ✓          | 17 / 17 / 17 |

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

## MongoDB Collections

| Collection      | Schema Fields                                                        | Populated By         |
| --------------- | -------------------------------------------------------------------- | -------------------- |
| `orders`        | `customerId`, `productName`, `quantity`, `amount`, `status`, `notes` | Order Service        |
| `payments`      | `orderId`, `customerId`, `amount`, `status`                          | Payment Service      |
| `notifications` | `eventType`, `payload`, `status`                                     | Notification Service |

---

## Commands Reference

### Docker Compose

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

### Docker Swarm

| Action                   | Command                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| Initialize Swarm         | `docker swarm init`                                                                        |
| Deploy stack             | `docker stack deploy -c deploy/docker-compose.swarm.yml microservices`                     |
| List services            | `docker stack services microservices`                                                      |
| List tasks (replicas)    | `docker stack ps microservices`                                                            |
| View service logs        | `docker service logs microservices_order-service --tail 50`                                |
| Scale a service          | `docker service scale microservices_order-service=5`                                       |
| Update service (rolling) | `docker service update --image microservices/api-gateway:latest microservices_api-gateway` |
| Remove stack             | `docker stack rm microservices`                                                            |
| Leave swarm              | `docker swarm leave --force`                                                               |

---

## Troubleshooting

### Port Conflicts

Ensure ports `3000`, `5672`, `15672`, and `27017` are not in use by other applications.

### Swarm Port Conflicts

If ports are already allocated, stop any existing containers first:

```bash
docker compose -f deploy/docker-compose.yml down
docker stack rm microservices
```

### Swarm Nginx Not Load Balancing

If all requests hit the same API Gateway instance in Docker Swarm, verify that `nginx.conf` uses the resolver-based approach (`resolver 127.0.0.11` + variable `proxy_pass`) documented above. Static `upstream` blocks cache the Swarm VIP and do not distribute traffic.

### RabbitMQ Connection Issues

If services restart repeatedly, check the RabbitMQ logs:

```bash
docker logs rabbitmq --tail 30
# or in Swarm:
docker service logs microservices_rabbitmq --tail 30
```

### MongoDB Connection Issues

Verify MongoDB is healthy before dependent services start:

```bash
docker exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### View Service Logs

```bash
# Docker Compose
docker logs api-gateway-1 --tail 20
docker logs order-service-1 --tail 20
docker logs payment-service-1 --tail 20
docker logs notification-service-1 --tail 20

# Docker Swarm
docker service logs microservices_api-gateway --tail 20
docker service logs microservices_order-service --tail 20
docker service logs microservices_payment-service --tail 20
docker service logs microservices_notification-service --tail 20
```

---

## License

MIT
