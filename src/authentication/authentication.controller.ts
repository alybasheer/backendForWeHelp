import { BadRequestException, Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticationService } from './authentication.service';
import { LocationDto } from './dto/location.dto';

@Controller('authentication')
export class AuthenticationController {
    constructor(private readonly authService: AuthenticationService) { }

    @Post('signup')
    async signup(@Body() body: { username: string; email: string; password: string }) {
        if (!body.username || !body.email || !body.password) {
            throw new BadRequestException('username, email and password are required');
        }
        const result = await this.authService.create(body);
        // result is { user, access_token }
        return {
            success: true,
            access_token: result.access_token,
            user: result.user,
        };
    }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        if (!body.email || !body.password) {
            throw new BadRequestException('email and password are required');
        }
        const auth = await this.authService.validateUser(body.email, body.password);
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
    @Post('location')
    async updateLocation(@Headers('authorization') auth: string, @Body() body: LocationDto) {
        if (!auth) throw new BadRequestException('Authorization header required');
        const token = auth.replace(/^Bearer\s+/i, '');
        const payload: any = new JwtService({}).verify(token, { secret: process.env.JWT_SECRET ?? 'dev_secret_key' });
        const userId = payload.sub;

        // body.latitude and body.longitude are guaranteed numbers now
        return this.authService.updateLocationById(userId, body.latitude, body.longitude);
    }

    /**
     * POST /authentication/google-login
     * Google OAuth Login endpoint with Firebase verification
     * 
     * Frontend flow:
     * 1. User clicks "Login with Google"
     * 2. Firebase/Google Sign-In handles authentication
     * 3. Get idToken from Firebase SDK
     * 4. Send idToken + username to this endpoint
     * 5. Backend verifies with Firebase Admin SDK
     * 6. Return access_token for app
     * 
     * Body: { idToken, username }
     */
    @Post('google-login')
    async loginWithGoogle(@Body() body: { idToken: string; username: string }) {
        if (!body.idToken) {
            throw new BadRequestException('idToken is required');
        }

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
