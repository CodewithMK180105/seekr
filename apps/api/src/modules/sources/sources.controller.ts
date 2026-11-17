import { Request, Response, NextFunction } from 'express';
import { createSourceSchema, updateSourceStatusSchema } from '@seekr/shared';
import { ApiResponse, SourceDto } from '@seekr/types';
import { sourcesService } from './sources.service.js';

export async function createSource(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createSourceSchema.parse(req.body);
    const source = await sourcesService.createSource(input);

    const response: ApiResponse<{ source: SourceDto }> = {
      success: true,
      data: { source },
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function listSources(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sources = await sourcesService.listSources();

    const response: ApiResponse<{ sources: SourceDto[] }> = {
      success: true,
      data: { sources },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getSourceById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const source = await sourcesService.getSourceById(req.params.id);

    const response: ApiResponse<{ source: SourceDto }> = {
      success: true,
      data: { source },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateSourceStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = updateSourceStatusSchema.parse(req.body);
    const source = await sourcesService.updateSourceStatus(req.params.id, status);

    const response: ApiResponse<{ source: SourceDto }> = {
      success: true,
      data: { source },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function deleteSource(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await sourcesService.deleteSource(req.params.id);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
