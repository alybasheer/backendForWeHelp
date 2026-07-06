import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';


@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }
    @Get(':role')
    findByRole(@Param('role') role: String) {
        return this.userService.findByRole(role);
    }

}
