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
