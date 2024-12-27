/**
 * Translation Controller
 * Handles translation requests with comprehensive validation, monitoring, and queue integration
 * @version 1.0.0
 */

// External dependencies
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { RateLimit } from 'express-rate-limit'; // ^7.1.0

// Internal dependencies
import { 
  TranslationRequest, 
  BatchTranslationRequest,
  TranslationJobStatus 
} from '../interfaces/translation';
import { 
  validateTranslationRequest, 
  validateBatchTranslationRequest 
} from '../validation/translation';
import { queueService } from '../services/queue';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

/**
 * Handles single detection translation requests
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export async function translateDetection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestId = uuidv4();
  const userId = req.user?.id || 'anonymous';

  try {
    logger.info('Processing translation request', {
      requestId,
      userId,
      service: 'translation_controller',
      traceId: requestId,
      spanId: 'translate_detection',
      environment: process.env.NODE_ENV || 'development'
    });

    // Extract and validate request
    const translationRequest: TranslationRequest = {
      sourceFormat: req.body.sourceFormat,
      targetFormat: req.body.targetFormat,
      content: req.body.content,
      validateResult: req.body.validateResult ?? true
    };

    // Validate request
    const validationResult = await validateTranslationRequest(translationRequest);
    if (!validationResult.isValid) {
      metrics.recordRequestMetric(
        'POST',
        '/translate',
        400,
        (Date.now() - startTime) / 1000,
        { errorType: 'validation_error' }
      );

      res.status(400).json({
        status: 'error',
        message: 'Invalid translation request',
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      return;
    }

    // Publish to queue
    await queueService.publishTranslationRequest({
      ...translationRequest,
      requestId,
      userId,
      priority: 5
    });

    // Record metrics
    metrics.recordRequestMetric(
      'POST',
      '/translate',
      202,
      (Date.now() - startTime) / 1000
    );

    // Return accepted response with tracking ID
    res.status(202).json({
      status: 'accepted',
      requestId,
      message: 'Translation request accepted',
      statusEndpoint: `/api/v1/translations/${requestId}/status`
    });

  } catch (error) {
    logger.error('Translation request failed', error as Error, {
      requestId,
      userId,
      service: 'translation_controller',
      traceId: requestId,
      spanId: 'translate_detection',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      'POST',
      '/translate',
      500,
      (Date.now() - startTime) / 1000,
      { errorType: 'internal_error' }
    );

    next(error);
  }
}

/**
 * Handles batch translation requests
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export async function translateBatch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const batchId = uuidv4();
  const userId = req.user?.id || 'anonymous';

  try {
    logger.info('Processing batch translation request', {
      requestId: batchId,
      userId,
      service: 'translation_controller',
      traceId: batchId,
      spanId: 'translate_batch',
      environment: process.env.NODE_ENV || 'development'
    });

    // Extract and validate batch request
    const batchRequest: BatchTranslationRequest = {
      detections: req.body.detections,
      targetFormat: req.body.targetFormat,
      batchOptions: req.body.batchOptions
    };

    // Validate batch request
    const validationResult = await validateBatchTranslationRequest(batchRequest);
    if (!validationResult.isValid) {
      metrics.recordRequestMetric(
        'POST',
        '/translate/batch',
        400,
        (Date.now() - startTime) / 1000,
        { errorType: 'batch_validation_error' }
      );

      res.status(400).json({
        status: 'error',
        message: 'Invalid batch translation request',
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      return;
    }

    // Publish batch request to queue
    await queueService.publishBatchRequest({
      files: batchRequest.detections.map(d => ({
        content: d.content,
        sourceFormat: d.format,
        filename: d.metadata?.filename || 'unknown'
      })),
      targetFormat: batchRequest.targetFormat,
      batchId,
      userId,
      totalCount: batchRequest.detections.length
    });

    // Record metrics
    metrics.recordRequestMetric(
      'POST',
      '/translate/batch',
      202,
      (Date.now() - startTime) / 1000
    );

    // Return accepted response with batch tracking info
    res.status(202).json({
      status: 'accepted',
      batchId,
      message: 'Batch translation request accepted',
      totalDetections: batchRequest.detections.length,
      statusEndpoint: `/api/v1/translations/batch/${batchId}/status`
    });

  } catch (error) {
    logger.error('Batch translation request failed', error as Error, {
      requestId: batchId,
      userId,
      service: 'translation_controller',
      traceId: batchId,
      spanId: 'translate_batch',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      'POST',
      '/translate/batch',
      500,
      (Date.now() - startTime) / 1000,
      { errorType: 'internal_error' }
    );

    next(error);
  }
}

/**
 * Retrieves translation job status
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export async function getTranslationStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const jobId = req.params.jobId;
  const userId = req.user?.id || 'anonymous';

  try {
    logger.info('Retrieving translation status', {
      requestId: jobId,
      userId,
      service: 'translation_controller',
      traceId: jobId,
      spanId: 'get_status',
      environment: process.env.NODE_ENV || 'development'
    });

    // Get queue status
    const queueStatus = await queueService.getQueueStatus();
    const jobStatus = await queueService.getJobStatus(jobId);

    // Record metrics
    metrics.recordRequestMetric(
      'GET',
      '/translate/status',
      200,
      (Date.now() - startTime) / 1000
    );

    // Return comprehensive status response
    res.status(200).json({
      status: 'success',
      jobId,
      translationStatus: jobStatus.status as TranslationJobStatus,
      progress: jobStatus.progress,
      queuePosition: jobStatus.queuePosition,
      estimatedTimeRemaining: jobStatus.estimatedTimeRemaining,
      errors: jobStatus.errors,
      warnings: jobStatus.warnings,
      metrics: {
        processingTime: jobStatus.processingTime,
        queueTime: jobStatus.queueTime,
        validationTime: jobStatus.validationTime
      },
      systemStatus: {
        queueHealth: queueStatus.isConnected ? 'healthy' : 'degraded',
        messageCount: queueStatus.messageCount
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve translation status', error as Error, {
      requestId: jobId,
      userId,
      service: 'translation_controller',
      traceId: jobId,
      spanId: 'get_status',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      'GET',
      '/translate/status',
      500,
      (Date.now() - startTime) / 1000,
      { errorType: 'internal_error' }
    );

    next(error);
  }
}