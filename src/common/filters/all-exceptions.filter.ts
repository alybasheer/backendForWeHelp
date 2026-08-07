import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Error as MongooseError } from 'mongoose';

/**
 * Global exception filter.
 *
 * Guarantees every error response has the shape:
 *   { success: false, message: string, statusCode: number }
 * and never leaks stack traces, database errors or internal details to
 * clients. Technical details are logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let message: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const bodyMessage = (body as Record<string, unknown>).message;
        if (Array.isArray(bodyMessage)) {
          message = bodyMessage.join('. ');
        } else if (typeof bodyMessage === 'string') {
          message = bodyMessage;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else if (
      exception instanceof MongooseError.CastError
    ) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid id format';
    } else if (
      exception instanceof MongooseError.ValidationError
    ) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = Object.values(exception.errors)
        .map((e) => e.message)
        .join('. ');
    } else if (
      exception instanceof Error &&
      (exception as Error & { code?: number }).code === 11000
    ) {
      statusCode = HttpStatus.CONFLICT;
      message = 'This record already exists';
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${ctx.getRequest().method} ${ctx.getRequest().url}: ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
    } else {
      this.logger.warn(
        `${ctx.getRequest().method} ${ctx.getRequest().url}: ${message}`,
      );
    }

    response.status(statusCode).json({
      success: false,
      message,
      statusCode,
    });
  }
}
