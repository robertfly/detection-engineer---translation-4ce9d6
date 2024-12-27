// React version: ^18.2.0
// Material UI version: ^5.14.0
// React Virtualized version: ^9.22.3
import React, { useState, useCallback, useEffect } from 'react';
import { TreeView, TreeItem } from '@mui/lab';
import { Box, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
  FolderOpen as FolderIcon,
  InsertDriveFile as FileIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { List, AutoSizer } from 'react-virtualized';
import { GitHubRepository, GitHubFile } from '../../interfaces/github';
import { useGithub } from '../../hooks/useGithub';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { DETECTION_FORMATS } from '../../config/constants';

/**
 * Props interface for the RepoBrowser component
 */
interface RepoBrowserProps {
  onFileSelect: (files: GitHubFile[]) => void;
  className?: string;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  ariaLabel?: string;
}

/**
 * A secure and accessible GitHub repository browser component
 * Implements WCAG 2.1 Level AA compliance with enhanced security monitoring
 */
const RepoBrowser: React.FC<RepoBrowserProps> = ({
  onFileSelect,
  className = '',
  maxFileSize = 1024 * 1024, // 1MB default
  allowedFileTypes = DETECTION_FORMATS.map(format => format.extension),
  ariaLabel = 'GitHub Repository Browser'
}) => {
  // State management
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  // GitHub hook with security context
  const {
    repositories,
    selectedFiles,
    fetchRepositories,
    fetchRepositoryFiles,
    validateFiles,
    rateLimit,
    loading
  } = useGithub();

  /**
   * Security-enhanced file validation
   */
  const validateFileSelection = useCallback((file: GitHubFile): boolean => {
    // Size validation
    if (file.size > maxFileSize) {
      logger.warn('File size exceeds limit', { 
        file: file.path, 
        size: file.size, 
        limit: maxFileSize 
      });
      return false;
    }

    // Type validation
    const fileExtension = `.${file.path.split('.').pop()}`;
    if (!allowedFileTypes.includes(fileExtension)) {
      logger.warn('Invalid file type', { 
        file: file.path, 
        type: fileExtension 
      });
      return false;
    }

    return true;
  }, [maxFileSize, allowedFileTypes]);

  /**
   * Handle file selection with security checks
   */
  const handleFileSelect = useCallback(async (nodes: string[]) => {
    try {
      const selectedPaths = nodes.filter(node => !expandedNodes.includes(node));
      const validatedFiles: GitHubFile[] = [];

      for (const path of selectedPaths) {
        const file = selectedFiles.find(f => f.path === path);
        if (file && validateFileSelection(file)) {
          validatedFiles.push(file);
        }
      }

      // Validate files for security and format compliance
      const validationResults = await validateFiles(validatedFiles);
      
      if (validationResults.every(result => result.isValid)) {
        onFileSelect(validatedFiles);
        metrics.trackUserActivity('file_selection', {
          count: validatedFiles.length,
          paths: validatedFiles.map(f => f.path)
        }, {
          userId: '', // Set by security context
          sessionId: '', // Set by security context
          userRole: '', // Set by security context
          ipAddress: '', // Set by security context
          timestamp: Date.now()
        });
      } else {
        logger.warn('File validation failed', { validationResults });
      }
    } catch (error) {
      logger.error('File selection error', { error });
    }
  }, [expandedNodes, selectedFiles, validateFiles, validateFileSelection, onFileSelect]);

  /**
   * Handle repository refresh with rate limiting
   */
  const handleRefresh = useCallback(async () => {
    try {
      if (rateLimit.remaining <= 0) {
        logger.warn('Rate limit exceeded', { rateLimit });
        return;
      }

      await fetchRepositories();
      if (currentPath) {
        await fetchRepositoryFiles(parseInt(currentPath.split('/')[0]), 'main');
      }

      metrics.trackUserActivity('refresh_repository', {
        path: currentPath
      }, {
        userId: '', // Set by security context
        sessionId: '', // Set by security context
        userRole: '', // Set by security context
        ipAddress: '', // Set by security context
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Repository refresh error', { error });
    }
  }, [fetchRepositories, fetchRepositoryFiles, currentPath, rateLimit]);

  /**
   * Render tree item with accessibility support
   */
  const renderTreeItem = useCallback((node: GitHubFile) => {
    const isFolder = node.type === 'dir';
    const icon = isFolder ? <FolderIcon /> : <FileIcon />;
    const validationStatus = node.validationStatus;
    
    return (
      <TreeItem
        key={node.path}
        nodeId={node.path}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Typography variant="body2">{node.name}</Typography>
            {validationStatus && (
              <Tooltip title={validationStatus.message || ''}>
                {validationStatus.isValid ? 
                  <CheckCircleIcon color="success" /> : 
                  <ErrorIcon color="error" />
                }
              </Tooltip>
            )}
          </Box>
        }
        aria-label={`${isFolder ? 'Folder' : 'File'}: ${node.name}`}
      />
    );
  }, []);

  /**
   * Virtualized tree view for performance
   */
  const renderVirtualizedTree = useCallback(() => (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          rowCount={selectedFiles.length}
          rowHeight={40}
          rowRenderer={({ index, style }) => (
            <div style={style}>
              {renderTreeItem(selectedFiles[index])}
            </div>
          )}
        />
      )}
    </AutoSizer>
  ), [selectedFiles, renderTreeItem]);

  return (
    <Box
      className={className}
      role="tree"
      aria-label={ariaLabel}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 1
      }}>
        <Typography variant="h6">Repository Browser</Typography>
        <Tooltip title="Refresh Repository">
          <IconButton
            onClick={handleRefresh}
            disabled={loading || rateLimit.remaining <= 0}
            aria-label="Refresh repository"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1
        }}>
          <CircularProgress aria-label="Loading repositories" />
        </Box>
      ) : (
        <TreeView
          aria-label="Repository file tree"
          defaultCollapseIcon={<FolderIcon />}
          defaultExpandIcon={<FolderIcon />}
          defaultEndIcon={<FileIcon />}
          expanded={expandedNodes}
          selected={selectedNodes}
          onNodeSelect={(_, nodeIds) => {
            setSelectedNodes(Array.isArray(nodeIds) ? nodeIds : [nodeIds]);
            handleFileSelect(Array.isArray(nodeIds) ? nodeIds : [nodeIds]);
          }}
          onNodeToggle={(_, nodeIds) => setExpandedNodes(nodeIds)}
          sx={{ flex: 1, overflowY: 'auto' }}
        >
          {renderVirtualizedTree()}
        </TreeView>
      )}
    </Box>
  );
};

export default RepoBrowser;