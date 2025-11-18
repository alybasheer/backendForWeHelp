import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { HelpsService } from './helps.service';

@Controller('helps')
export class HelpsController {
    constructor(private readonly helpServices: HelpsService) { }
    @Post()
    addNewHelp(@Body() body: { title: string; category: string; time: string }) {
        return this.helpServices.addNewHelp(body);

    }
    @Get()
    getAllHelps() {
        return this.helpServices
    }
    //put
    @Put(':id')
    updateHelp(@Param('id') id: string, @Body() body: { title: string; category: string; time: string }) {
        return this.helpServices.UpdateHelp(Number(id), body)
    }
    //Patch
    @Patch(':id')
    updateRequired(@Param('id') id: string, @Body() body: { title: string, category: string, time: string }) {
        return this.helpServices.PatchHelp(Number(id), body)
    }
} 
