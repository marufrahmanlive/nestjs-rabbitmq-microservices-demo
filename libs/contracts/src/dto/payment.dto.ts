import { IsString, IsNumber, Min } from "class-validator";

export class ProcessPaymentDto {
  @IsString()
  orderId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  customerId: string;
}
