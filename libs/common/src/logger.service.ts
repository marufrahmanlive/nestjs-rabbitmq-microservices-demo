import { Injectable, LoggerService, Optional } from "@nestjs/common";
import * as winston from "winston";

@Injectable()
export class AppLogger implements LoggerService {
  private logger: winston.Logger;
  private context: string;

  constructor(@Optional() context?: string) {
    this.context = context || "APP";
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`;
        })
      ),
      transports: [new winston.transports.Console()]
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, ...optionalParams: any[]): void {
    this.logger.info(message, ...optionalParams);
  }

  error(message: string, ...optionalParams: any[]): void {
    this.logger.error(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: any[]): void {
    this.logger.warn(message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: any[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: string, ...optionalParams: any[]): void {
    this.logger.verbose(message, ...optionalParams);
  }
}
