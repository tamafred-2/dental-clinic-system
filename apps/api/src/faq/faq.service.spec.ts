import { FaqService } from './faq.service';

describe('FaqService', () => {
  it('returns only published FAQs in display order', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'faq-1', question: 'Question?', answer: 'Answer.' },
      ]);
    const service = new FaqService({ faq: { findMany } } as never);

    await expect(service.findAllPublic()).resolves.toEqual([
      { id: 'faq-1', question: 'Question?', answer: 'Answer.' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { published: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, question: true, answer: true },
    });
  });
});
