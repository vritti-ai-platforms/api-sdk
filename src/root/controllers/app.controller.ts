import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthType, Require } from '../../auth/decorators/require.decorator';
import { ApiHealthCheck } from '../docs/app.docs';
import { AppService } from '../services/app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Returns a welcome message indicating the API is running
  @Get()
  @Require(AuthType.Public)
  @ApiHealthCheck()
  getHello(): string {
    return this.appService.getHello();
  }
}
