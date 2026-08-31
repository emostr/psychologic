import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('analytics')
@Roles(AccountRole.PSYCHOLOGIST)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('attention')
  attention() {
    return this.analytics.attention();
  }

  @Get('report/:testId')
  report(@Param('testId') testId: string) {
    return this.analytics.testReport(testId);
  }

  @Get('class/:classId')
  classReport(@Param('classId') classId: string, @Query('testId') testId: string) {
    return this.analytics.classReport(classId, testId);
  }
}
