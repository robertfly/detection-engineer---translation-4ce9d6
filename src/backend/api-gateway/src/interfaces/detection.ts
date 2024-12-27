// @ts-nocheck
/**
 * Detection interface definitions for the API Gateway service
 * Defines core data structures for handling security detections across multiple SIEM platforms
 * @version 1.0.0
 * @module interfaces/detection
 */

import { UUID } from 'crypto'; // version: latest

/**
 * Enumeration of supported detection formats with version compatibility
 * Represents the various SIEM and detection rule formats supported by the platform
 */
export enum DetectionFormat {
    SPLUNK = 'SPLUNK',        // Splunk Search Processing Language (SPL)
    QRADAR = 'QRADAR',        // IBM QRadar AQL
    SIGMA = 'SIGMA',          // SIGMA Generic Detection Format
    KQL = 'KQL',             // Microsoft Azure KQL
    PALOALTO = 'PALOALTO',    // Palo Alto Networks XQL
    CROWDSTRIKE = 'CROWDSTRIKE', // Crowdstrike NG-SIEM
    YARA = 'YARA',           // YARA Malware Detection
    YARAL = 'YARAL'          // YARA-L Chronicle Detection
}

/**
 * Interface for detection metadata and version control information
 * Supports GitHub integration and detection versioning
 */
export interface DetectionMetadata {
    /** Human-readable description of the detection rule */
    description: string;
    
    /** Categorization and searchable tags for the detection */
    tags: string[];
    
    /** Optional GitHub repository URL where the detection is stored */
    github_url?: string;
    
    /** Git commit hash for version tracking */
    commit_hash?: string;
}

/**
 * Core interface representing a security detection rule
 * Includes version control and metadata support
 */
export interface Detection {
    /** Unique identifier for the detection */
    id: UUID;
    
    /** Detection rule content in the specified format */
    content: string;
    
    /** Format of the detection rule */
    format: DetectionFormat;
    
    /** Semantic version of the detection rule */
    version: string;
    
    /** Creation timestamp */
    created_at: Date;
    
    /** Last modification timestamp */
    updated_at: Date;
    
    /** ID of the user who created/owns the detection */
    user_id: UUID;
    
    /** Flag indicating if the detection is currently active */
    is_active: boolean;
    
    /** Associated metadata and version control information */
    metadata: DetectionMetadata;
}

/**
 * Interface for creating new detection rules
 * Supports metadata and format specification
 */
export interface CreateDetectionRequest {
    /** Detection rule content */
    content: string;
    
    /** Format of the detection rule */
    format: DetectionFormat;
    
    /** Optional metadata for the detection */
    metadata?: DetectionMetadata;
}

/**
 * Interface for updating existing detection rules
 * Supports version control and status updates
 */
export interface UpdateDetectionRequest {
    /** Updated detection content */
    content?: string;
    
    /** Flag to activate/deactivate the detection */
    is_active?: boolean;
    
    /** Updated metadata */
    metadata?: DetectionMetadata;
}

/**
 * Interface for batch translation requests
 * Supports processing multiple detections simultaneously
 */
export interface BatchTranslationRequest {
    /** Array of detections to translate */
    detections: Detection[];
    
    /** Target format for all detections in the batch */
    target_format: DetectionFormat;
}