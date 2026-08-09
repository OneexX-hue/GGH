import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ModulesRegistryService } from './modules-registry.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('modules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('modules.manage')
export class ModulesRegistryController {
  constructor(private readonly modulesRegistryService: ModulesRegistryService) {}

  @Get()
  list() {
    return this.modulesRegistryService.list();
  }

  @Post()
  register(@Body() dto: CreateModuleDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.modulesRegistryService.register(dto, user.userId, req.ip);
  }

  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.modulesRegistryService.update(key, dto, user.userId, req.ip);
  }
}
