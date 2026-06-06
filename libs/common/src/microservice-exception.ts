import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Custom exception for microservice-level errors.
 * Can carry structured metadata for audit logging.
 */
export class MicroserviceException extends HttpException {
  public readonly errorCode: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode = "MICROSERVICE_ERROR",
    metadata?: Record<string, any>
  ) {
    super(
      {
        statusCode,
        message,
        errorCode,
        timestamp: new Date().toISOString(),
        metadata
      },
      statusCode
    );
    this.errorCode = errorCode;
    this.metadata = metadata;
  }
}
