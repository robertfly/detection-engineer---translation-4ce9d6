/**
 * @fileoverview A React component that displays detailed validation results for translated detection rules.
 * Implements Material Design 3.0 with comprehensive accessibility features, confidence scoring,
 * and detailed issue reporting.
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import {
  Typography,
  CircularProgress,
  List,
  ListItem,
  Chip,
  Box,
  Button,
  useTheme,
  alpha
} from '@mui/material'; // v5.14.0
import {
  ErrorOutline,
  CheckCircle,
  Warning
} from '@mui/icons-material'; // v5.14.0

// Internal imports
import { ValidationResult, ValidationStatus, ValidationSeverity, ValidationIssue } from '../../interfaces/validation';
import { Card } from '../common/Card';
import { processValidationResult, formatValidationIssue } from '../../utils/validation';

/**
 * Props interface for ValidationReport component
 */
interface ValidationReportProps {
  /** Validation result data */
  validationResult: ValidationResult;
  /** Callback for exporting validation report */
  onExport: () => void;
  /** Callback for closing validation report */
  onClose: () => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * A React component that displays comprehensive validation results for translated detection rules
 * with full accessibility support.
 */
const ValidationReport = React.memo<ValidationReportProps>(({
  validationResult,
  onExport,
  onClose,
  className
}) => {
  const theme = useTheme();
  
  // Process validation result with enhanced formatting
  const processedResult = useMemo(() => 
    processValidationResult(validationResult),
    [validationResult]
  );

  /**
   * Renders appropriate status icon with accessibility attributes
   */
  const renderStatusIcon = (status: ValidationStatus) => {
    const iconProps = {
      fontSize: 'large',
      role: 'img',
      'aria-hidden': false,
      sx: { mr: 1 }
    };

    switch (status) {
      case ValidationStatus.SUCCESS:
        return (
          <CheckCircle
            {...iconProps}
            color="success"
            aria-label="Validation successful"
          />
        );
      case ValidationStatus.WARNING:
        return (
          <Warning
            {...iconProps}
            color="warning"
            aria-label="Validation passed with warnings"
          />
        );
      case ValidationStatus.ERROR:
        return (
          <ErrorOutline
            {...iconProps}
            color="error"
            aria-label="Validation failed"
          />
        );
    }
  };

  /**
   * Renders confidence score with accessibility features
   */
  const renderConfidenceScore = (score: number) => {
    const color = score >= 95 ? 'success' : score >= 70 ? 'warning' : 'error';
    
    return (
      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
          mr: 2
        }}
        role="presentation"
      >
        <CircularProgress
          variant="determinate"
          value={score}
          color={color}
          size={60}
          aria-label={`Confidence score: ${score}%`}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            aria-hidden="true"
          >
            {`${Math.round(score)}%`}
          </Typography>
        </Box>
      </Box>
    );
  };

  /**
   * Renders list of validation issues grouped by severity
   */
  const renderIssueList = (issues: ValidationIssue[]) => {
    const groupedIssues = useMemo(() => {
      const groups = {
        [ValidationSeverity.HIGH]: [],
        [ValidationSeverity.MEDIUM]: [],
        [ValidationSeverity.LOW]: []
      };
      
      issues.forEach(issue => {
        groups[issue.severity].push(issue);
      });
      
      return groups;
    }, [issues]);

    return (
      <List aria-label="Validation issues" sx={{ width: '100%' }}>
        {Object.entries(groupedIssues).map(([severity, severityIssues]) => (
          severityIssues.length > 0 && (
            <React.Fragment key={severity}>
              <ListItem
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.05),
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{ fontWeight: 'medium' }}
                >
                  {severity} Severity Issues ({severityIssues.length})
                </Typography>
              </ListItem>
              {severityIssues.map((issue, index) => {
                const formattedIssue = formatValidationIssue(issue);
                return (
                  <ListItem
                    key={`${severity}-${index}`}
                    sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                    role="listitem"
                    aria-label={`${severity} severity issue: ${formattedIssue.message}`}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body1">
                        {formattedIssue.message}
                      </Typography>
                      <Chip
                        label={formattedIssue.code}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                    {formattedIssue.suggestions.length > 0 && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 2 }}
                      >
                        Suggestion: {formattedIssue.suggestions[0]}
                      </Typography>
                    )}
                  </ListItem>
                );
              })}
            </React.Fragment>
          )
        ))}
      </List>
    );
  };

  return (
    <Card
      className={className}
      variant="outlined"
      aria-label="Validation Report"
      data-testid="validation-report"
      highContrast
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {renderStatusIcon(processedResult.status)}
          <Typography variant="h5" component="h2">
            Validation Report
          </Typography>
          {renderConfidenceScore(processedResult.confidenceScore)}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Summary
          </Typography>
          <Typography variant="body2" paragraph>
            Source Format: {processedResult.sourceFormat}
            <br />
            Target Format: {processedResult.targetFormat}
            <br />
            Total Issues: {processedResult.issues.length}
          </Typography>
        </Box>

        {processedResult.issues.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Issues
            </Typography>
            {renderIssueList(processedResult.issues)}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            aria-label="Close validation report"
          >
            Close
          </Button>
          <Button
            variant="contained"
            onClick={onExport}
            aria-label="Export validation report"
          >
            Export Report
          </Button>
        </Box>
      </Box>
    </Card>
  );
});

// Display name for debugging
ValidationReport.displayName = 'ValidationReport';

export default ValidationReport;