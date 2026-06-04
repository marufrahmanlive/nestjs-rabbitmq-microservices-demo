import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true, collection: "notifications" })
export class Notification extends Document {
  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ default: "unread" })
  status: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
