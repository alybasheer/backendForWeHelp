import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
    let controller: AdminController;
    let jwtService: JwtService;
    let adminService: { getAllApplications: jest.Mock };

    beforeEach(async () => {
        adminService = { getAllApplications: jest.fn().mockResolvedValue([]) };
        const module = await Test.createTestingModule({
            controllers: [AdminController],
            providers: [
                { provide: AdminService, useValue: adminService },
                { provide: JwtService, useValue: new JwtService({ secret: 'dev_secret_key' }) },
            ],
        }).compile();
        controller = module.get(AdminController);
        jwtService = module.get(JwtService);
    });

    it('returns 401 for a garbage token instead of 500', async () => {
        await expect(
            controller.getApplications('Bearer not.a.valid.token', 'pending'),
        ).rejects.toThrow(UnauthorizedException);
        expect(adminService.getAllApplications).not.toHaveBeenCalled();
    });

    it('returns 401 for an expired token instead of 500', async () => {
        const expired = jwtService.sign(
            { sub: 'x', role: 'admin' },
            { expiresIn: '-1s' },
        );
        await expect(
            controller.getApplications(`Bearer ${expired}`, 'pending'),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('returns 401 when no Authorization header is provided', async () => {
        await expect(
            controller.getApplications(undefined as any, 'pending'),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('returns 403 when token is valid but role is not admin', async () => {
        const userToken = jwtService.sign({ sub: 'u1', role: 'user' });
        await expect(
            controller.getApplications(`Bearer ${userToken}`, 'pending'),
        ).rejects.toThrow(ForbiddenException);
    });

    it('allows a valid admin token and calls the service', async () => {
        const adminToken = jwtService.sign({ sub: 'a1', role: 'admin' });
        const result = await controller.getApplications(`Bearer ${adminToken}`, 'pending');
        expect(adminService.getAllApplications).toHaveBeenCalledWith('pending');
        expect(result.success).toBe(true);
    });
});