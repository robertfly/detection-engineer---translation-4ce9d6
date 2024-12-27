// react version: 18.2.0
import React, { useCallback, useMemo } from 'react';
// @mui/x-data-grid version: 6.10.0
import { DataGrid, GridColDef, GridRowParams, GridSortModel, GridFilterModel } from '@mui/x-data-grid';
// @mui/material version: 5.14.0
import { Stack, Typography, Tooltip, useTheme } from '@mui/material';
// react-i18next version: 13.0.0
import { useTranslation } from 'react-i18next';

// Internal imports
import { TranslationResult, BatchTranslationStatus, ValidationReport } from '../../interfaces/translation';
import Card from '../common/Card';
import Button from '../common/Button';

// Interface for component props
interface ResultsGridProps {
  results: TranslationResult[];
  batchStatus: BatchTranslationStatus;
  onViewResult: (id: UUID) => Promise<void>;
  onDownload: (id: UUID) => Promise<void>;
  onViewReport: (id: UUID) => Promise<void>;
  pageSize?: number;
  sortModel?: GridSortModel;
  filterModel?: GridFilterModel;
  loading?: boolean;
  error?: Error | null;
  'aria-label'?: string;
}

// Get semantic color for status indicators
const getStatusColor = (status: string, theme: Theme) => {
  const colors = {
    COMPLETED: theme.palette.success.main,
    FAILED: theme.palette.error.main,
    PROCESSING: theme.palette.info.main,
    PENDING: theme.palette.warning.main,
    VALIDATING: theme.palette.info.light,
    CANCELLED: theme.palette.grey[500],
  };
  return colors[status] || theme.palette.grey[500];
};

// Format confidence score with localization
const formatConfidenceScore = (score: number, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(score);
};

// Enhanced Results Grid component with accessibility features
const ResultsGrid = React.memo<ResultsGridProps>(({
  results,
  batchStatus,
  onViewResult,
  onDownload,
  onViewReport,
  pageSize = 10,
  sortModel,
  filterModel,
  loading = false,
  error = null,
  'aria-label': ariaLabel,
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  // Memoized column definitions with accessibility enhancements
  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'sourceFormat',
      headerName: t('grid.sourceFormat'),
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" component="span">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'targetFormat',
      headerName: t('grid.targetFormat'),
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" component="span">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'confidenceScore',
      headerName: t('grid.confidence'),
      flex: 1,
      renderCell: (params) => {
        const score = formatConfidenceScore(params.value, i18n.language);
        const color = params.value >= 0.95 ? theme.palette.success.main : theme.palette.warning.main;
        
        return (
          <Tooltip title={t('grid.confidenceTooltip', { score })}>
            <Typography
              variant="body2"
              component="span"
              sx={{ color, fontWeight: 'medium' }}
              aria-label={t('grid.confidenceAriaLabel', { score })}
            >
              {score}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'status',
      headerName: t('grid.status'),
      flex: 1,
      renderCell: (params) => {
        const statusColor = getStatusColor(params.value, theme);
        
        return (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            aria-label={t(`status.${params.value.toLowerCase()}`)}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: statusColor,
              }}
              role="presentation"
            />
            <Typography variant="body2" component="span" sx={{ color: statusColor }}>
              {t(`status.${params.value.toLowerCase()}`)}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: 'actions',
      headerName: t('grid.actions'),
      flex: 1.5,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleViewClick(params.row.id)}
            aria-label={t('grid.viewAriaLabel')}
          >
            {t('grid.view')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleDownloadClick(params.row.id)}
            aria-label={t('grid.downloadAriaLabel')}
          >
            {t('grid.download')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleReportClick(params.row.id)}
            aria-label={t('grid.reportAriaLabel')}
          >
            {t('grid.report')}
          </Button>
        </Stack>
      ),
    },
  ], [theme, t, i18n.language]);

  // Enhanced click handlers with loading states
  const handleViewClick = useCallback(async (id: UUID) => {
    try {
      await onViewResult(id);
    } catch (error) {
      console.error('Error viewing result:', error);
    }
  }, [onViewResult]);

  const handleDownloadClick = useCallback(async (id: UUID) => {
    try {
      await onDownload(id);
    } catch (error) {
      console.error('Error downloading result:', error);
    }
  }, [onDownload]);

  const handleReportClick = useCallback(async (id: UUID) => {
    try {
      await onViewReport(id);
    } catch (error) {
      console.error('Error viewing report:', error);
    }
  }, [onViewReport]);

  return (
    <Card
      variant="outlined"
      elevation={1}
      aria-label={ariaLabel || t('grid.resultsGridLabel')}
    >
      <DataGrid
        rows={results}
        columns={columns}
        pageSize={pageSize}
        rowsPerPageOptions={[5, 10, 25, 50]}
        sortModel={sortModel}
        filterModel={filterModel}
        loading={loading}
        error={error}
        autoHeight
        disableColumnMenu={false}
        disableSelectionOnClick
        getRowId={(row) => row.id}
        sx={{
          '& .MuiDataGrid-cell:focus': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '-1px',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: theme.palette.action.hover,
          },
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText',
          },
        }}
        localeText={{
          noRowsLabel: t('grid.noResults'),
          errorOverlayDefaultLabel: t('grid.error'),
          loadingLabel: t('grid.loading'),
        }}
        aria-label={t('grid.resultsGridLabel')}
        components={{
          NoRowsOverlay: () => (
            <Stack height="100%" alignItems="center" justifyContent="center">
              <Typography>{t('grid.noResults')}</Typography>
            </Stack>
          ),
          ErrorOverlay: () => (
            <Stack height="100%" alignItems="center" justifyContent="center">
              <Typography color="error">{error?.message || t('grid.error')}</Typography>
            </Stack>
          ),
        }}
      />
    </Card>
  );
});

ResultsGrid.displayName = 'ResultsGrid';

export default ResultsGrid;