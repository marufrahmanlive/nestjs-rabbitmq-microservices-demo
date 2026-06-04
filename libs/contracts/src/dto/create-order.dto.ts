import { IsString, IsNumber, IsOptional, Min } from "class-validator";

export class CreateOrderDto {
  @IsString()
  customerId: string;

  @IsString()
  productName: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
