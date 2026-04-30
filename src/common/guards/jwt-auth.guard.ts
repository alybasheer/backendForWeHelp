import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Reusable JWT authentication guard.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded payload to `request.user`.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('protected')
 *   handler(@Req() req) { req.user.sub; }
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('Authorization header required');
        }

        const token = authHeader.replace(/^Bearer\s+/i, '');

        try {
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET ?? 'dev_secret_key',
            });
            // Attach decoded JWT payload to the request object
            (request as any).user = payload;
            return true;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
