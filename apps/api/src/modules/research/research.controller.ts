import { Request, Response, NextFunction } from 'express';
import {
  ValidationError,
  NotFoundError,
  researchRequestsTotal,
  researchStreamingOutcomesTotal,
} from '@seekr/shared';
import { researchQuerySchema } from './research.schema.js';
import { ResearchService } from './research.service.js';
import { ResearchRepository } from './research.repository.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ResearchController {
  private researchService: ResearchService;
  private researchRepository: ResearchRepository;

  constructor(options: {
    researchService?: ResearchService;
    researchRepository?: ResearchRepository;
  } = {}) {
    this.researchService = options.researchService || new ResearchService();
    this.researchRepository = options.researchRepository || new ResearchRepository();
  }

  /**
   * POST /api/v1/research
   * Synchronous research synthesis returning structured answer and verified citations.
   */
  public handleResearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = researchQuerySchema.parse(req.body);

      const response = await this.researchService.research({
        query: validated.query,
        searchMode: validated.mode,
        maxSources: validated.maxSources,
        temperature: validated.temperature,
        userId: (req as any).user?.userId,
        skipCache: validated.skipCache || req.headers['cache-control'] === 'no-cache',
      });

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err) {
      try {
        researchRequestsTotal.inc({
          mode: (req.body?.mode || 'HYBRID').toUpperCase(),
          status: 'error',
        });
      } catch {}
      next(err);
    }
  };

  /**
   * POST /api/v1/research/stream
   * Real-time token streaming using Server-Sent Events (SSE).
   */
  public handleResearchStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let headersSent = false;
    const controller = new AbortController();

    // Listen for client disconnection (res.on('close') when response has not ended)
    res.on('close', () => {
      if (!res.writableEnded) {
        controller.abort();
        try {
          researchStreamingOutcomesTotal.inc({ outcome: 'client_abort' });
        } catch {}
      }
    });

    try {
      const validated = researchQuerySchema.parse(req.body);

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      headersSent = true;

      const sendEvent = (event: string, data: unknown) => {
        if (!res.writableEnded) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      };

      await this.researchService.researchStream(
        {
          query: validated.query,
          searchMode: validated.mode,
          maxSources: validated.maxSources,
          temperature: validated.temperature,
          userId: (req as any).user?.userId,
          skipCache: validated.skipCache || req.headers['cache-control'] === 'no-cache',
        },
        {
          onSources: (sources) => {
            sendEvent('sources', { sources });
          },
          onToken: (token) => {
            sendEvent('token', { token });
          },
          onCitations: (citations) => {
            sendEvent('citations', { citations });
          },
          onComplete: (session) => {
            sendEvent('complete', {
              id: session.id,
              sessionId: session.id,
              query: session.query,
              answer: session.answer,
              searchMode: session.searchMode,
              latencyMs: session.latencyMs,
              insufficientContext: session.insufficientContext,
              usage: session.usage,
            });
            res.end();
          },
        },
        controller.signal
      );
    } catch (err: any) {
      try {
        researchStreamingOutcomesTotal.inc({ outcome: 'error' });
      } catch {}
      if (headersSent) {
        // SSE headers already sent: emit structured error event
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: {
              code: err.code || 'RESEARCH_STREAM_ERROR',
              message: err.message || 'An error occurred during streaming synthesis',
            },
          })}\n\n`
        );
        res.end();
      } else {
        // Headers not sent yet: forward to Express centralized error handler
        next(err);
      }
    }
  };

  /**
   * GET /api/v1/research/:id
   * Retrieves a previously saved research session by UUID.
   */
  public handleGetSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        throw new ValidationError('Invalid research session ID format. Expected UUID.');
      }

      const session = await this.researchRepository.getSessionById(id);
      if (!session) {
        throw new NotFoundError(`Research session with ID "${id}" was not found.`);
      }

      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/research/:id/sources
   * Retrieves detailed source cards and citation references for a session.
   */
  public handleGetSessionSources = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !UUID_REGEX.test(id)) {
        throw new ValidationError('Invalid research session ID format. Expected UUID.');
      }

      const sources = await this.researchRepository.getSourcesBySessionId(id);
      if (!sources) {
        throw new NotFoundError(`Research session with ID "${id}" was not found.`);
      }

      res.status(200).json({
        success: true,
        data: {
          sessionId: id,
          sources,
          totalSources: sources.length,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
