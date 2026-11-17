import {
  prisma,
  validateSafeUrl,
  ConflictError,
  NotFoundError,
  CreateSourceInput,
} from '@seekr/shared';
import { SourceDto, SourceStatus } from '@seekr/types';

export class SourcesService {
  async createSource(input: CreateSourceInput): Promise<SourceDto> {
    const safeUrl = await validateSafeUrl(input.baseUrl);

    const existing = await prisma.source.findFirst({
      where: { baseUrl: safeUrl },
    });

    if (existing) {
      throw new ConflictError(`A source with base URL "${safeUrl}" already exists`);
    }

    const source = await prisma.source.create({
      data: {
        name: input.name,
        baseUrl: safeUrl,
        sourceType: input.sourceType,
        status: 'ACTIVE',
      },
    });

    return {
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      sourceType: source.sourceType,
      status: source.status,
      documentCount: 0,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  async listSources(): Promise<SourceDto[]> {
    const sources = await prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      baseUrl: s.baseUrl,
      sourceType: s.sourceType,
      status: s.status,
      documentCount: s._count.documents,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async getSourceById(id: string): Promise<SourceDto> {
    const source = await prisma.source.findUnique({
      where: { id },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!source) {
      throw new NotFoundError(`Source with ID "${id}" not found`);
    }

    return {
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      sourceType: source.sourceType,
      status: source.status,
      documentCount: source._count.documents,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  async updateSourceStatus(id: string, status: SourceStatus): Promise<SourceDto> {
    const existing = await prisma.source.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Source with ID "${id}" not found`);
    }

    const updated = await prisma.source.update({
      where: { id },
      data: { status },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      baseUrl: updated.baseUrl,
      sourceType: updated.sourceType,
      status: updated.status,
      documentCount: updated._count.documents,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteSource(id: string): Promise<{ message: string }> {
    const existing = await prisma.source.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Source with ID "${id}" not found`);
    }

    await prisma.source.delete({ where: { id } });

    return { message: 'Source deleted successfully' };
  }
}

export const sourcesService = new SourcesService();
