import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';

@Controller('authentication')
export class AuthenticationController {
    constructor(private readonly authService: AuthenticationService) { }

    @Post('signup')
    async signup(@Body() body: { username: string; email: string; password: string }) {
        if (!body.username || !body.email || !body.password) {
            throw new BadRequestException('username, email and password are required');
        }
        return this.authService.create(body);
    }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        if (!body.email || !body.password) {
            throw new BadRequestException('email and password are required');
        }
        const user = await this.authService.validateUser(body.email, body.password);
        if (!user) return { success: false, message: 'Invalid credentials' };
        return { success: true, user };
    }

    @Get('signup')
    async getSignupPage() {
        return this.authService.findAll();
    }
}
