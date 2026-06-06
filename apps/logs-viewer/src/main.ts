import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { generateInstanceId } from "@app/common";

async function bootstrap() {
  const instanceId = generateInstanceId();
  process.env.INSTANCE_ID = instanceId;
  process.env.SERVICE_NAME = "logs-viewer";

  const app = await NestFactory.create(AppModule);

  // Enable CORS for local development
  app.enableCors();

  const port = process.env.LOG_VIEWER_PORT || 9000;
  await app.listen(port);
  console.log(
    `[LOGS-VIEWER] Instance ${instanceId} running on http://localhost:${port}`
  );
}
bootstrap();
