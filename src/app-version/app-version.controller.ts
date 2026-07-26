import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('app-version')
export class AppVersionController {
  @Get()
  getVersion(@Req() req: Request) {
    const jsonPath = path.join(__dirname, '..', '..', 'public', 'version.json');
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(raw);
      const protocol = req.protocol;
      const host = req.get('host');
      data.apkUrl = `${protocol}://${host}${data.apkUrl}`;
      return { success: true, data };
    } catch {
      return { success: false, message: 'Version info not available' };
    }
  }
}
