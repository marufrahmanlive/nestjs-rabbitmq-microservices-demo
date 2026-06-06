import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { generateInstanceId } from "@app/common";
import { AppLogger } from "@app/common";

async function bootstrap() {
  const instanceId = generateInstanceId();
  process.env.INSTANCE_ID = instanceId;
  process.env.SERVICE_NAME = "api-gateway";

  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(`API-GATEWAY-${instanceId}`)
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[API-GATEWAY] Instance ${instanceId} running on port ${port}`);
}
bootstrap();
