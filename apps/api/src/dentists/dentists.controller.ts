import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CreateDentistDto } from './dto/create-dentist.dto';
import { UpdateDentistDto } from './dto/update-dentist.dto';
import { DentistsService } from './dentists.service';

@Controller('dentists')
export class DentistsController {
  constructor(private readonly dentistsService: DentistsService) {}

  @Get()
  findAllPublic() {
    return this.dentistsService.findAllPublic();
  }

  @Get('admin/all')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllForAdmin() {
    return this.dentistsService.findAllForAdmin();
  }

  @Get(':id')
  findOnePublic(@Param('id') id: string) {
    return this.dentistsService.findOnePublic(id);
  }

  @Post()
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateDentistDto) {
    return this.dentistsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDentistDto) {
    return this.dentistsService.update(id, dto);
  }
}
