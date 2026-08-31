import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { TestsService } from './tests.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAccount } from '../common/decorators/current-account.decorator';
import { RequestAccount } from '../common/types';
import { CreateTestDto, DuplicateTestDto, UpdateTestDto } from './dto/tests.dto';

@Controller('tests')
@Roles(AccountRole.PSYCHOLOGIST)
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Get()
  list() {
    return this.tests.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tests.getFull(id);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string) {
    return this.tests.getForTaking(id);
  }

  @Post()
  create(@CurrentAccount() account: RequestAccount, @Body() dto: CreateTestDto) {
    return this.tests.create(account.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTestDto) {
    return this.tests.update(id, dto);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @CurrentAccount() account: RequestAccount,
    @Body() dto: DuplicateTestDto,
  ) {
    return this.tests.duplicate(id, account.id, dto.title);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.tests.setPublished(id, true);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.tests.setPublished(id, false);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tests.remove(id);
  }
}
