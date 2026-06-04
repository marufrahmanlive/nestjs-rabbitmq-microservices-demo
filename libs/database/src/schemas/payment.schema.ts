import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true, collection: "payments" })
export class Payment extends Document {
  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: "pending" })
  status: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
