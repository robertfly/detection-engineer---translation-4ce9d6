// axios version: ^1.6.0
// express-rate-limit version: ^7.1.0

import { apiClient, transformError } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import { validateDetectionFormat } from '../utils/validation';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';
import { 
    Detection, 
    DetectionFormat, 
    DetectionMetadata, 
    isValidDetectionFormat 
} from '../interfaces/detection';
import { ValidationResult } from '../interfaces/validation';

/**
 * Custom error class for detection service operations with enhanced error tracking
 */
export class DetectionServiceError extends Error {
    readonly code: string;
    readonly details: any;
    readonly requestId: string;
    readonly timestamp: string;

    constructor(message: string, code: string, details?: any) {
        super(message);
        this.name = 'DetectionServiceError';
        this.code = code;
        this.details = details;
        this.requestId = crypto.randomUUID();
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Interface for paginated detection list response
 */
interface DetectionListResponse {
    detections: Detection[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Interface for detection creation request
 */
interface CreateDetectionRequest {
    content: string;
    format: DetectionFormat;
    metadata: DetectionMetadata;
}

/**
 * Rate limiter configuration following security best practices
 */
const detectionRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many detection requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Detection service class providing comprehensive detection management capabilities
 */
export const DetectionService = {
    /**
     * Retrieves a paginated list of detections with enhanced error handling
     * @param page - Page number for pagination
     * @param limit - Number of items per page
     * @param format - Optional format filter
     * @returns Promise resolving to paginated detection list
     */
    async getDetections(
        page: number = 1,
        limit: number = 10,
        format?: DetectionFormat
    ): Promise<DetectionListResponse> {
        try {
            logger.info('Fetching detections', { page, limit, format });

            if (page < 1 || limit < 1) {
                throw new DetectionServiceError(
                    'Invalid pagination parameters',
                    'INVALID_PARAMS'
                );
            }

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(format && { format }),
            });

            const response = await apiClient.get(
                `${API_ENDPOINTS.detection.list}?${params}`
            );

            logger.info('Successfully fetched detections', {
                total: response.data.total,
                page,
                limit,
            });

            return response.data;
        } catch (error) {
            const transformedError = transformError(error);
            logger.error('Failed to fetch detections', { error: transformedError });
            throw new DetectionServiceError(
                'Failed to fetch detections',
                'FETCH_ERROR',
                transformedError
            );
        }
    },

    /**
     * Retrieves a single detection by ID with enhanced error handling
     * @param id - Detection ID
     * @returns Promise resolving to detection details
     */
    async getDetectionById(id: string): Promise<Detection> {
        try {
            logger.info('Fetching detection by ID', { id });

            const response = await apiClient.get(
                API_ENDPOINTS.detection.get.replace(':id', id)
            );

            logger.info('Successfully fetched detection', { id });
            return response.data;
        } catch (error) {
            const transformedError = transformError(error);
            logger.error('Failed to fetch detection', { 
                error: transformedError,
                id 
            });
            throw new DetectionServiceError(
                'Failed to fetch detection',
                'FETCH_ERROR',
                transformedError
            );
        }
    },

    /**
     * Creates a new detection with format validation and error handling
     * @param data - Detection creation request data
     * @returns Promise resolving to created detection
     */
    async createDetection(data: CreateDetectionRequest): Promise<Detection> {
        try {
            logger.info('Creating new detection', { format: data.format });

            if (!isValidDetectionFormat(data.format)) {
                throw new DetectionServiceError(
                    'Invalid detection format',
                    'INVALID_FORMAT'
                );
            }

            const validationResult = await validateDetectionFormat(
                data.content,
                data.format
            );

            if (!validationResult.valid) {
                throw new DetectionServiceError(
                    'Invalid detection content',
                    'VALIDATION_ERROR',
                    validationResult.errors
                );
            }

            const response = await apiClient.post(
                API_ENDPOINTS.detection.create,
                data
            );

            logger.info('Successfully created detection', { 
                id: response.data.id 
            });
            return response.data;
        } catch (error) {
            const transformedError = transformError(error);
            logger.error('Failed to create detection', { 
                error: transformedError 
            });
            throw new DetectionServiceError(
                'Failed to create detection',
                'CREATE_ERROR',
                transformedError
            );
        }
    },

    /**
     * Updates an existing detection with validation and error handling
     * @param id - Detection ID
     * @param data - Updated detection data
     * @returns Promise resolving to updated detection
     */
    async updateDetection(
        id: string,
        data: Partial<CreateDetectionRequest>
    ): Promise<Detection> {
        try {
            logger.info('Updating detection', { id });

            if (data.content && data.format) {
                const validationResult = await validateDetectionFormat(
                    data.content,
                    data.format
                );

                if (!validationResult.valid) {
                    throw new DetectionServiceError(
                        'Invalid detection content',
                        'VALIDATION_ERROR',
                        validationResult.errors
                    );
                }
            }

            const response = await apiClient.put(
                API_ENDPOINTS.detection.update.replace(':id', id),
                data
            );

            logger.info('Successfully updated detection', { id });
            return response.data;
        } catch (error) {
            const transformedError = transformError(error);
            logger.error('Failed to update detection', { 
                error: transformedError,
                id 
            });
            throw new DetectionServiceError(
                'Failed to update detection',
                'UPDATE_ERROR',
                transformedError
            );
        }
    },

    /**
     * Deletes a detection with confirmation and error handling
     * @param id - Detection ID
     * @returns Promise resolving to deletion confirmation
     */
    async deleteDetection(id: string): Promise<void> {
        try {
            logger.info('Deleting detection', { id });

            await apiClient.delete(
                API_ENDPOINTS.detection.delete.replace(':id', id)
            );

            logger.info('Successfully deleted detection', { id });
        } catch (error) {
            const transformedError = transformError(error);
            logger.error('Failed to delete detection', { 
                error: transformedError,
                id 
            });
            throw new DetectionServiceError(
                'Failed to delete detection',
                'DELETE_ERROR',
                transformedError
            );
        }
    }
};

export type { 
    DetectionListResponse,
    CreateDetectionRequest
};