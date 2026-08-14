import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ClinicService } from './clinic.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Controller('clinic')
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Get()
  findPublic() {
    return this.clinicService.findPublic();
  }

  @Put()
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateClinicDto) {
    return this.clinicService.update(dto);
  }
}
