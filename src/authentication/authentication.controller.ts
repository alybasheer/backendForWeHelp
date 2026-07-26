import { Body, Controller, Get, Post, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LocationDto } from './dto/location.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('authentication')
export class AuthenticationController {
    constructor(private readonly authService: AuthenticationService) { }

    @Post('signup')
    async signup(@Body() body: SignupDto) {
        const result = await this.authService.create(body);
        // result is { user, access_token }
        return {
            success: true,
            access_token: result.access_token,
            user: result.user,
        };
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        const auth = await this.authService.validateUser(loginDto.email, loginDto.password);
        if (!auth) { throw new UnauthorizedException('Invalid email or password') };
        // auth is { user, access_token }
        return {
            success: true,
            access_token: auth.access_token,
            user: auth.user,
        };
    }

    @Get('signup')
    async getSignupPage() {
        return this.authService.findAll();
    }

    /**
     * POST /authentication/location
     * Saves the user's current coordinates. The frontend should call this
     * after obtaining permission to read location (navigator.geolocation API
     * on web). The request must include the Authorization: Bearer <token>
     * header so we can identify the user via JWT `sub`.
     *
     * Frontend flow (summary):
     * - Ask user for permission to access location (browser prompt).
     * - On success, read latitude/longitude from `navigator.geolocation.getCurrentPosition`.
     * - POST to this endpoint with JSON { latitude, longitude } and header `Authorization: Bearer <token>`.
     */
    @UseGuards(JwtAuthGuard)
    @Post('location')
    async updateLocation(@Request() req, @Body() body: LocationDto) {
        const userId = req.user.sub;
        // body.latitude and body.longitude are guaranteed numbers now
        return this.authService.updateLocationById(userId, body.latitude, body.longitude);
    }

    @Post('google-login')
    async loginWithGoogle(@Body() body: GoogleLoginDto) {
        try {
            const result = await this.authService.loginWithGoogle(body.idToken, body.username);

            return {
                success: true,
                access_token: result.access_token,
                user: result.user,
            };
        } catch (error) {
            throw new UnauthorizedException('Google login failed: ' + error.message);
        }
    }

}
