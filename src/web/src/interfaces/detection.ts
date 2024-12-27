/**
 * @fileoverview TypeScript interface definitions for security detection rules and related types.
 * Provides core data structures for handling detections across multiple SIEM platforms with strict type safety.
 * @version 1.0.0
 */

// External imports
import { UUID } from 'crypto'; // v18.0.0+

/**
 * Enumeration of supported detection formats with strict type checking.
 * Represents all major SIEM and detection platforms supported by the system.
 */
export enum DetectionFormat {
    SPLUNK = 'SPLUNK',         // Splunk Search Processing Language (SPL)
    QRADAR = 'QRADAR',        // IBM QRadar AQL
    SIGMA = 'SIGMA',          // SIGMA Generic Detection Format
    KQL = 'KQL',             // Microsoft Azure KQL
    PALOALTO = 'PALOALTO',    // Palo Alto Networks XQL
    CROWDSTRIKE = 'CROWDSTRIKE', // Crowdstrike NG-SIEM
    YARA = 'YARA',           // YARA Malware Detection
    YARAL = 'YARAL'          // YARA-L Chronicle Detection
}

/**
 * Enumeration of detection severity levels.
 * Used for categorizing and prioritizing security detections.
 */
export enum DetectionSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

/**
 * Interface for detection metadata with enhanced information.
 * Provides additional context and classification for security detections.
 */
export interface DetectionMetadata {
    /** Human-readable name of the detection */
    name: string;
    
    /** Detailed description of the detection's purpose and behavior */
    description: string;
    
    /** Array of categorization tags for the detection */
    tags: string[];
    
    /** Severity level classification */
    severity: DetectionSeverity;
    
    /** Timestamp of last modification, automatically managed */
    readonly last_modified: Date;
}

/**
 * Core interface representing a security detection rule with comprehensive type safety.
 * Defines the fundamental structure for all detection rules in the system.
 */
export interface Detection {
    /** Unique identifier for the detection, immutable after creation */
    readonly id: UUID;
    
    /** Actual detection rule content in the specified format */
    content: string;
    
    /** Format of the detection rule, immutable after creation */
    readonly format: DetectionFormat;
    
    /** Timestamp of detection creation, immutable */
    readonly created_at: Date;
    
    /** ID of the user who created the detection, immutable */
    readonly user_id: UUID;
    
    /** Flag indicating if the detection is currently active */
    is_active: boolean;
    
    /** Additional metadata and classification information */
    metadata: DetectionMetadata;
}

/**
 * Type guard to check if a string is a valid DetectionFormat
 * @param format - String to check
 * @returns Boolean indicating if the string is a valid DetectionFormat
 */
export function isValidDetectionFormat(format: string): format is DetectionFormat {
    return Object.values(DetectionFormat).includes(format as DetectionFormat);
}

/**
 * Type guard to check if a string is a valid DetectionSeverity
 * @param severity - String to check
 * @returns Boolean indicating if the string is a valid DetectionSeverity
 */
export function isValidDetectionSeverity(severity: string): severity is DetectionSeverity {
    return Object.values(DetectionSeverity).includes(severity as DetectionSeverity);
}