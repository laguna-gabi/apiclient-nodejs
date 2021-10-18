import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UserSecurityModule } from './auth.security.module';
import { AuthService } from './auth.service';
import { CustomStrategy } from './strategies/custom.strategy';

@Module({
  imports: [PassportModule, UserSecurityModule],
  providers: [AuthService, CustomStrategy],
})
export class AuthModule {}
