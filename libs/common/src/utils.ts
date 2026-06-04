import * as crypto from "crypto";

export function generateInstanceId(): string {
  return `${process.env.SERVICE_NAME || "UNKNOWN"}-${crypto
    .randomBytes(4)
    .toString("hex")}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parseMessagePayload(message: any): any {
  if (Buffer.isBuffer(message)) {
    const str = message.toString();
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
  if (typeof message === "string") {
    try {
      return JSON.parse(message);
    } catch {
      return message;
    }
  }
  return message;
}

export function formatLogMessage(
  serviceName: string,
  instanceId: string,
  queueName: string,
  patternName: string
): string {
  return `[${serviceName}]\nQueue: ${queueName}\nPattern: ${patternName}\nInstance: ${instanceId}`;
}
