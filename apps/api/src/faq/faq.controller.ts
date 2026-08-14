import { Controller, Get } from '@nestjs/common';
import { FaqService } from './faq.service';

@Controller('faqs')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  findAllPublic() {
    return this.faqService.findAllPublic();
  }
}
