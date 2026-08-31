import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePsychologistDto, RenameAccountDto } from './dto/accounts.dto';

@Controller('accounts')
@Roles(AccountRole.ADMIN)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }

  @Post()
  create(@Body() dto: CreatePsychologistDto) {
    return this.accounts.createPsychologist(dto.fullName, dto.login);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: RenameAccountDto) {
    return this.accounts.rename(id, dto.fullName);
  }

  @Post(':id/reset-totp')
  resetTotp(@Param('id') id: string) {
    return this.accounts.resetTotp(id);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.accounts.resetPassword(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accounts.remove(id);
  }
}
