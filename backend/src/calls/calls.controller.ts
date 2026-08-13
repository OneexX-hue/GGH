import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CallsHistoryService } from './calls-history.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly callsHistory: CallsHistoryService) {}

  @Get('history')
  history(@CurrentUser() user: AuthenticatedUser, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.callsHistory.listForUser(user.userId, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
