import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { CsrfController } from './controllers/csrf.controller';
import { AppService } from './services/app.service';

@Module({
  controllers: [AppController, CsrfController],
  providers: [AppService],
})
export class RootModule {}
