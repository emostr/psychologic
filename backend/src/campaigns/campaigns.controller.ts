import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAccount } from '../common/decorators/current-account.decorator';
import { RequestAccount } from '../common/types';
import { AddClassesDto, AddCodesDto, CreateCampaignDto } from './dto/campaigns.dto';

@Controller('campaigns')
@Roles(AccountRole.PSYCHOLOGIST)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Post()
  create(@CurrentAccount() account: RequestAccount, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(account.id, dto);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.campaigns.one(id);
  }

  @Get(':id/sheet')
  sheet(@Param('id') id: string, @Query('includeUsed') includeUsed?: string) {
    return this.campaigns.sheet(id, includeUsed === 'true');
  }

  @Post(':id/classes')
  addClasses(@Param('id') id: string, @Body() dto: AddClassesDto) {
    return this.campaigns.addClasses(id, dto);
  }

  @Post(':id/codes')
  addCodes(@Param('id') id: string, @Body() dto: AddCodesDto) {
    return this.campaigns.addCodes(id, dto.classId, dto.count);
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.campaigns.close(id);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.campaigns.reopen(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
