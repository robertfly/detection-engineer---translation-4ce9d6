// react version: 18.2.0
import React, { useCallback, useEffect, useState } from 'react';
// @mui/material version: 5.14.0
import { 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Checkbox, 
  Typography, 
  Tooltip,
  Box
} from '@mui/material';
// @mui/icons-material version: 5.14.0
import {
  FolderOutlined,
  InsertDriveFileOutlined,
  ErrorOutline,
  CheckCircleOutline
} from '@mui/icons-material';
// react-window version: 1.8.9
import { FixedSizeList as VirtualList } from 'react-window';

import { GitHubFile } from '../../interfaces/github';
import { useGithub } from '../../hooks/useGithub';
import Loading from '../common/Loading';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { UI_CONSTANTS } from '../../config/constants';

// Validation status types
type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'unsupported';

interface RepoFileListProps {
  repositoryId: number;
  branch: string;
  path?: string;
  onFileSelect: (file: GitHubFile, validationStatus: ValidationStatus) => void;
  onFolderOpen: (path: string) => void;
  onError: (error: Error) => void;
}

// Constants for file list display
const FILE_ITEM_HEIGHT = 48;
const MAX_VISIBLE_ITEMS = 10;
const FILE_SIZE_LIMIT = 1024 * 1024; // 1MB

/**
 * Enhanced file list component with security validation and accessibility features
 */
const RepoFileList: React.FC<RepoFileListProps> = ({
  repositoryId,
  branch,
  path = '',
  onFileSelect,
  onFolderOpen,
  onError
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [validationStatus, setValidationStatus] = useState<Map<string, ValidationStatus>>(new Map());
  const [listHeight, setListHeight] = useState(0);

  // GitHub hook with rate limit handling
  const { fetchRepositoryFiles, getRateLimit } = useGithub();

  /**
   * Validate file for processing
   */
  const validateFile = useCallback((file: GitHubFile): ValidationStatus => {
    // Check file size
    if (file.size > FILE_SIZE_LIMIT) {
      return 'invalid';
    }

    // Check file extension for supported formats
    const supportedExtensions = ['.spl', '.yml', '.aql', '.kql', '.xml', '.json', '.yar', '.yaral'];
    const hasValidExtension = supportedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    return hasValidExtension ? 'valid' : 'unsupported';
  }, []);

  /**
   * Handle file selection with security validation
   */
  const handleFileSelect = useCallback(async (file: GitHubFile) => {
    try {
      // Check rate limits before processing
      const rateLimit = await getRateLimit();
      if (rateLimit.remaining <= 0) {
        throw new Error('GitHub API rate limit exceeded');
      }

      // Get or compute validation status
      let status = validationStatus.get(file.path);
      if (!status) {
        status = validateFile(file);
        setValidationStatus(prev => new Map(prev).set(file.path, status!));
      }

      // Track file selection metrics
      metrics.trackUserActivity('file_selected', {
        fileType: file.type,
        fileSize: file.size,
        validationStatus: status
      }, {
        userId: '', // Set by metrics middleware
        sessionId: '', // Set by metrics middleware
        userRole: '', // Set by metrics middleware
        ipAddress: '', // Set by metrics middleware
        timestamp: Date.now()
      });

      onFileSelect(file, status);

    } catch (error: any) {
      logger.error('File selection failed', { error, file });
      onError(error);
    }
  }, [getRateLimit, validateFile, validationStatus, onFileSelect, onError]);

  /**
   * Handle folder navigation with progress tracking
   */
  const handleFolderClick = useCallback(async (folder: GitHubFile) => {
    try {
      setLoading(true);
      const sanitizedPath = folder.path.replace(/[^a-zA-Z0-9-_/]/g, '');
      onFolderOpen(sanitizedPath);

      const result = await fetchRepositoryFiles(repositoryId, branch, sanitizedPath);
      if (result.success && result.data) {
        setFiles(result.data);
        
        // Pre-validate new files
        const newValidationStatus = new Map(validationStatus);
        result.data.forEach(file => {
          if (file.type === 'file' && !newValidationStatus.has(file.path)) {
            newValidationStatus.set(file.path, validateFile(file));
          }
        });
        setValidationStatus(newValidationStatus);
      }

    } catch (error: any) {
      logger.error('Folder navigation failed', { error, folder });
      onError(error);
    } finally {
      setLoading(false);
    }
  }, [
    repositoryId,
    branch,
    fetchRepositoryFiles,
    onFolderOpen,
    onError,
    validateFile,
    validationStatus
  ]);

  /**
   * Render individual file/folder item
   */
  const renderFileItem = useCallback(({ index, style }) => {
    const file = files[index];
    const status = validationStatus.get(file.path);

    return (
      <ListItem
        button
        style={style}
        onClick={() => file.type === 'dir' ? handleFolderClick(file) : handleFileSelect(file)}
        aria-label={`${file.type === 'dir' ? 'Folder' : 'File'}: ${file.name}`}
        sx={{
          '&:hover': {
            backgroundColor: 'action.hover'
          },
          '&:focus-visible': {
            outline: theme => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '-2px'
          }
        }}
      >
        <ListItemIcon>
          {file.type === 'dir' ? (
            <FolderOutlined color="primary" />
          ) : (
            <InsertDriveFileOutlined color="action" />
          )}
        </ListItemIcon>
        <ListItemText 
          primary={file.name}
          secondary={file.type === 'file' ? `Size: ${(file.size / 1024).toFixed(1)} KB` : null}
        />
        {file.type === 'file' && status && (
          <Tooltip title={`Status: ${status}`}>
            <Box component="span" sx={{ ml: 1 }}>
              {status === 'valid' && <CheckCircleOutline color="success" />}
              {status === 'invalid' && <ErrorOutline color="error" />}
              {status === 'unsupported' && <ErrorOutline color="warning" />}
            </Box>
          </Tooltip>
        )}
      </ListItem>
    );
  }, [files, validationStatus, handleFileSelect, handleFolderClick]);

  // Initial file fetch and list height calculation
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        const result = await fetchRepositoryFiles(repositoryId, branch, path);
        if (result.success && result.data) {
          setFiles(result.data);
          
          // Calculate list height
          const itemCount = result.data.length;
          const maxHeight = FILE_ITEM_HEIGHT * MAX_VISIBLE_ITEMS;
          setListHeight(Math.min(itemCount * FILE_ITEM_HEIGHT, maxHeight));
          
          // Pre-validate files
          const initialValidationStatus = new Map();
          result.data.forEach(file => {
            if (file.type === 'file') {
              initialValidationStatus.set(file.path, validateFile(file));
            }
          });
          setValidationStatus(initialValidationStatus);
        }
      } catch (error: any) {
        logger.error('Failed to fetch repository files', { error, repositoryId, branch, path });
        onError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [repositoryId, branch, path, fetchRepositoryFiles, validateFile, onError]);

  if (loading) {
    return <Loading message="Loading repository files..." />;
  }

  if (files.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ p: 2, textAlign: 'center' }}
      >
        No files found in this location
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden'
      }}
    >
      <VirtualList
        height={listHeight}
        width="100%"
        itemCount={files.length}
        itemSize={FILE_ITEM_HEIGHT}
        overscanCount={2}
      >
        {renderFileItem}
      </VirtualList>
    </Box>
  );
};

export default RepoFileList;