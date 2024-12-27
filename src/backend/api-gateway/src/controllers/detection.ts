/**
 * Detection Controller
 * Handles HTTP requests for security detection rule operations with comprehensive validation,
 * error handling, and async processing capabilities.
 * @module controllers/detection
 * @version 1.0.0
 */

// External dependencies
import { Request, Response } from 'express'; // ^4.18.2
import { NotFoundError, BadRequestError, TooManyRequestsError } from 'http-errors'; // ^2.0.0
import { rateLimit } from 'express-rate-limit'; // ^7.1.0

// Internal dependencies
import {
  Detection,
  DetectionFormat,
  CreateDetectionRequest,
  UpdateDetectionRequest,
  BatchDetectionRequest,
  GitHubSyncRequest
} from '../interfaces/detection';
import {
  createDetectionSchema,
  updateDetectionSchema,
  validateDetectionFormat,
  batchDetectionSchema,
  githubSyncSchema
} from '../validation/detection';
import { queueService } from '../services/queue';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants
const BATCH_SIZE_LIMIT = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100;

/**
 * Rate limiter middleware for detection operations
 */
const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Creates a new detection rule with validation and async processing
 */
export const createDetection = async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;
  const userId = req.user?.id;

  try {
    // Validate request body against schema
    const detectionData = req.body as CreateDetectionRequest;
    await createDetectionSchema.validateAsync(detectionData);

    // Validate detection format syntax
    const validationResult = await validateDetectionFormat(
      detectionData.content,
      detectionData.format
    );

    if (!validationResult.success) {
      throw new BadRequestError(`Invalid detection format: ${validationResult.errors.join(', ')}`);
    }

    // Generate metadata
    const detection: Detection = {
      id: crypto.randomUUID(),
      content: detectionData.content,
      format: detectionData.format,
      version: '1.0.0',
      created_at: new Date(),
      updated_at: new Date(),
      user_id: userId,
      is_active: true,
      metadata: {
        ...detectionData.metadata,
        description: detectionData.metadata?.description || '',
        tags: detectionData.metadata?.tags || []
      }
    };

    // Queue async translation job if requested
    if (req.query.translate === 'true') {
      await queueService.publishTranslationRequest({
        content: detection.content,
        sourceFormat: detection.format,
        targetFormat: req.query.targetFormat as DetectionFormat,
        requestId,
        userId
      });
    }

    // Record metrics
    metrics.recordRequestMetric(
      'POST',
      '/detections',
      201,
      (Date.now() - startTime) / 1000
    );

    logger.info('Detection created successfully', {
      requestId,
      service: 'api_gateway',
      userId,
      traceId: requestId,
      spanId: 'create_detection',
      environment: process.env.NODE_ENV || 'development'
    });

    return res.status(201).json({
      success: true,
      data: detection,
      validation: validationResult
    });

  } catch (error) {
    logger.error('Failed to create detection', error as Error, {
      requestId,
      service: 'api_gateway',
      userId,
      traceId: requestId,
      spanId: 'create_detection_error',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      'POST',
      '/detections',
      error instanceof BadRequestError ? 400 : 500,
      (Date.now() - startTime) / 1000,
      { errorType: error.name }
    );

    throw error;
  }
};

/**
 * Processes batch detection requests with async queue integration
 */
export const processBatchDetection = async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const batchId = crypto.randomUUID();
  const userId = req.user?.id;

  try {
    // Validate batch request
    const batchRequest = req.body as BatchDetectionRequest;
    await batchDetectionSchema.validateAsync(batchRequest);

    if (batchRequest.detections.length > BATCH_SIZE_LIMIT) {
      throw new BadRequestError(`Batch size exceeds limit of ${BATCH_SIZE_LIMIT}`);
    }

    // Queue batch job
    await queueService.publishBatchRequest({
      files: batchRequest.detections.map(d => ({
        content: d.content,
        sourceFormat: d.format,
        filename: d.metadata?.description || 'unnamed'
      })),
      targetFormat: req.query.targetFormat as DetectionFormat,
      batchId,
      userId,
      totalCount: batchRequest.detections.length
    });

    metrics.recordRequestMetric(
      'POST',
      '/detections/batch',
      202,
      (Date.now() - startTime) / 1000
    );

    logger.info('Batch detection request queued', {
      requestId: batchId,
      service: 'api_gateway',
      userId,
      traceId: batchId,
      spanId: 'batch_detection',
      environment: process.env.NODE_ENV || 'development'
    });

    return res.status(202).json({
      success: true,
      batchId,
      status: 'queued',
      statusEndpoint: `/api/v1/detections/batch/${batchId}/status`
    });

  } catch (error) {
    logger.error('Failed to process batch detection request', error as Error, {
      requestId: batchId,
      service: 'api_gateway',
      userId,
      traceId: batchId,
      spanId: 'batch_detection_error',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      'POST',
      '/detections/batch',
      error instanceof BadRequestError ? 400 : 500,
      (Date.now() - startTime) / 1000,
      { errorType: error.name }
    );

    throw error;
  }
};

/**
 * Synchronizes detections with GitHub repository
 */
export const syncGitHubRepository = async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const syncId = crypto.randomUUID();
  const userId = req.user?.id;

  try {
    // Validate GitHub sync request
    const syncRequest = req.body as GitHubSyncRequest;
    await githubSyncSchema.validateAsync(syncRequest);

    // Queue GitHub sync job
    await queueService.publishGitHubSync({
      repository: syncRequest.repository,
      branch: syncRequest.branch || 'main',
      syncId,
      userId
    });

    metrics.recordRequestMetric(
      'POST',
      '/detections/github/sync',
      202,
      (Date.now() - startTime) / 1000
    );

    logger.info('GitHub sync request queued', {
      requestId: syncId,
      service: 'api_gateway',
      userId,
      traceId: syncId,
      spanId: 'github_sync',
      environment: process.env.NODE_ENV || 'development'
    });

    return res.status(202).json({
      success: true,
      syncId,
      status: 'queued',
      statusEndpoint: `/api/v1/detections/github/sync/${syncId}/status`
    });

  } catch (error) {
    logger.error('Failed to process GitHub sync request', error as Error, {
      requestId: syncId,
      service: 'api_gateway',
      userId,
      traceId: syncId,
      spanId: 'github_sync_error',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      'POST',
      '/detections/github/sync',
      error instanceof BadRequestError ? 400 : 500,
      (Date.now() - startTime) / 1000,
      { errorType: error.name }
    );

    throw error;
  }
};

export default {
  createDetection,
  processBatchDetection,
  syncGitHubRepository
};