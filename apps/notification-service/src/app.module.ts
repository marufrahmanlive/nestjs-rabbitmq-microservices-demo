import { Module } from "@nestjs/common";
import { DatabaseModule } from "@app/database";
import { AppLogger } from "@app/common";
import { NotificationController } from "./notification.controller";

@Module({
  imports: [DatabaseModule.register()],
  controllers: [NotificationController],
  providers: [AppLogger]
})
export class AppModule {}
