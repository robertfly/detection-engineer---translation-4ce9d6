/**
 * Advanced validation module for security detection rules
 * Implements format-specific validation, caching, and comprehensive error reporting
 * @module validation/detection
 * @version 1.0.0
 */

import Joi from 'joi'; // version: 17.9.0
import { BadRequestError } from 'http-errors'; // version: 2.0.0
import NodeCache from 'node-cache'; // version: 5.1.2
import {
    Detection,
    DetectionFormat,
    CreateDetectionRequest,
    UpdateDetectionRequest,
    ValidationResult
} from '../interfaces/detection';

/**
 * Regular expression patterns for format-specific validation
 */
const FORMAT_VALIDATION_RULES = {
    [DetectionFormat.SPLUNK]: '^\\s*search\\s+.+',
    [DetectionFormat.QRADAR]: '^\\s*SELECT\\s+.+',
    [DetectionFormat.SIGMA]: '^\\s*title:\\s*.+',
    [DetectionFormat.KQL]: '^\\s*[\\w]+\\s*\\|.+',
    [DetectionFormat.PALOALTO]: '^\\s*SELECT\\s+.+\\s+FROM\\s+.+',
    [DetectionFormat.CROWDSTRIKE]: '^\\s*event_platform\\s*=.+',
    [DetectionFormat.YARA]: '^\\s*rule\\s+[\\w_]+\\s*{.+}',
    [DetectionFormat.YARAL]: '^\\s*YARA-L\\s+[\\w_]+\\s*{.+}'
} as const;

// Cache TTL in seconds
const VALIDATION_CACHE_TTL = 300;

// Maximum validation time in milliseconds
const MAX_VALIDATION_TIME = 5000;

/**
 * Interface for validation options
 */
interface ValidationOptions {
    cacheTTL?: number;
    maxValidationTime?: number;
    strictMode?: boolean;
}

/**
 * Performance monitoring decorator
 */
function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        const start = process.hrtime();
        try {
            const result = await originalMethod.apply(this, args);
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            if (duration > MAX_VALIDATION_TIME) {
                console.warn(`Validation performance warning: ${propertyKey} took ${duration}ms`);
            }
            return result;
        } catch (error) {
            throw error;
        }
    };
    return descriptor;
}

/**
 * Main validator class with caching support
 */
export class DetectionValidator {
    private cache: NodeCache;
    private validationRules: typeof FORMAT_VALIDATION_RULES;
    private options: ValidationOptions;

    constructor(options: ValidationOptions = {}) {
        this.cache = new NodeCache({
            stdTTL: options.cacheTTL || VALIDATION_CACHE_TTL,
            checkperiod: 120
        });
        this.validationRules = FORMAT_VALIDATION_RULES;
        this.options = {
            maxValidationTime: options.maxValidationTime || MAX_VALIDATION_TIME,
            strictMode: options.strictMode || false,
            ...options
        };
    }

    /**
     * Main validation method with caching support
     */
    @measurePerformance
    public async validate(content: string, format: DetectionFormat): Promise<ValidationResult> {
        const cacheKey = `${format}:${content}`;
        const cachedResult = this.cache.get<ValidationResult>(cacheKey);

        if (cachedResult) {
            return cachedResult;
        }

        const result = await this.performValidation(content, format);
        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Performs detailed validation of detection content
     */
    private async performValidation(content: string, format: DetectionFormat): Promise<ValidationResult> {
        try {
            // Basic format validation
            if (!this.validateBasicFormat(content, format)) {
                throw new BadRequestError(`Invalid ${format} format`);
            }

            // Deep structure validation
            const structureValidation = await this.validateDetectionStructure(content, format);
            if (!structureValidation.success) {
                return structureValidation;
            }

            // Format-specific validation
            const formatValidation = await this.validateFormatSpecifics(content, format);
            if (!formatValidation.success) {
                return formatValidation;
            }

            return {
                success: true,
                format,
                errors: [],
                warnings: []
            };
        } catch (error) {
            return {
                success: false,
                format,
                errors: [error.message],
                warnings: []
            };
        }
    }

    /**
     * Validates basic format using regex patterns
     */
    private validateBasicFormat(content: string, format: DetectionFormat): boolean {
        const pattern = new RegExp(this.validationRules[format], 'im');
        return pattern.test(content);
    }

    /**
     * Validates detection structure and relationships
     */
    private async validateDetectionStructure(content: string, format: DetectionFormat): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            switch (format) {
                case DetectionFormat.SIGMA:
                    if (!content.includes('detection:')) {
                        errors.push('Missing detection section in SIGMA rule');
                    }
                    break;
                case DetectionFormat.YARA:
                case DetectionFormat.YARAL:
                    if (!content.includes('strings:')) {
                        warnings.push('No strings section defined in YARA rule');
                    }
                    break;
                case DetectionFormat.SPLUNK:
                    if (!content.toLowerCase().includes('index=')) {
                        warnings.push('No index specified in Splunk query');
                    }
                    break;
                // Add other format-specific structure validations
            }

            return {
                success: errors.length === 0,
                format,
                errors,
                warnings
            };
        } catch (error) {
            return {
                success: false,
                format,
                errors: [`Structure validation failed: ${error.message}`],
                warnings
            };
        }
    }

    /**
     * Performs format-specific validation checks
     */
    private async validateFormatSpecifics(content: string, format: DetectionFormat): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            switch (format) {
                case DetectionFormat.SPLUNK:
                    this.validateSplunkQuery(content, errors, warnings);
                    break;
                case DetectionFormat.KQL:
                    this.validateKQLQuery(content, errors, warnings);
                    break;
                // Add other format-specific validations
            }

            return {
                success: errors.length === 0,
                format,
                errors,
                warnings
            };
        } catch (error) {
            return {
                success: false,
                format,
                errors: [`Format-specific validation failed: ${error.message}`],
                warnings
            };
        }
    }

    private validateSplunkQuery(content: string, errors: string[], warnings: string[]) {
        if (content.includes('| head') || content.includes('| tail')) {
            warnings.push('Using head/tail commands may limit detection effectiveness');
        }
        if (!content.includes('| stats') && !content.includes('| table')) {
            warnings.push('Consider adding stats or table command for better output formatting');
        }
    }

    private validateKQLQuery(content: string, errors: string[], warnings: string[]) {
        if (!content.includes('project')) {
            warnings.push('Consider adding project operator to optimize output fields');
        }
        if (content.includes('*')) {
            warnings.push('Using wildcards may impact query performance');
        }
    }
}

/**
 * Joi schema for detection creation requests
 */
export const createDetectionSchema = Joi.object<CreateDetectionRequest>({
    content: Joi.string().required().max(50000),
    format: Joi.string().valid(...Object.values(DetectionFormat)).required(),
    metadata: Joi.object({
        description: Joi.string(),
        tags: Joi.array().items(Joi.string()),
        github_url: Joi.string().uri(),
        commit_hash: Joi.string().pattern(/^[a-f0-9]{40}$/)
    })
});

/**
 * Joi schema for detection update requests
 */
export const updateDetectionSchema = Joi.object<UpdateDetectionRequest>({
    content: Joi.string().max(50000),
    is_active: Joi.boolean(),
    metadata: Joi.object({
        description: Joi.string(),
        tags: Joi.array().items(Joi.string()),
        github_url: Joi.string().uri(),
        commit_hash: Joi.string().pattern(/^[a-f0-9]{40}$/)
    })
});

export default DetectionValidator;