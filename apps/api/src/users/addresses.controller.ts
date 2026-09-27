import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { type AddressDto, type AddressInput, addressInputSchema } from '@open-boox/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AddressesService } from './addresses.service';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<AddressDto[]> {
    return this.addresses.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addressInputSchema)) body: AddressInput,
  ): Promise<AddressDto> {
    return this.addresses.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addressInputSchema)) body: AddressInput,
  ): Promise<AddressDto> {
    return this.addresses.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.addresses.remove(user.id, id);
  }

  @Post(':id/default')
  @HttpCode(200)
  setDefault(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AddressDto> {
    return this.addresses.setDefault(user.id, id);
  }
}
