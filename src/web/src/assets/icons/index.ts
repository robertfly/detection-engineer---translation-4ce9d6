/**
 * @fileoverview Central export point for Material UI icons used throughout the application
 * Implements Material Design 3.0 rounded variants for enhanced visibility and accessibility
 * @version 1.0.0
 */

// @mui/icons-material v5.14.0 - Material UI Icons with rounded styling
import {
  HelpOutlineRounded,
  PaymentRounded,
  InfoOutlineRounded,
  AddCircleOutlineRounded,
  CloseRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  FileUploadRounded,
  DashboardRounded,
  AccountCircleRounded,
  WarningRounded,
  SettingsRounded,
  StarRounded,
} from '@mui/icons-material';

/**
 * Help/Info icon [?] component with rounded styling for better visibility
 * Used for displaying help tooltips and information popovers
 */
export const HelpIcon = HelpOutlineRounded;

/**
 * Payment icon [$] component with rounded styling for better visibility
 * Used for payment-related actions and indicators
 */
export const PaymentIcon = PaymentRounded;

/**
 * Information icon [i] component with rounded styling for better visibility
 * Used for general information indicators and notices
 */
export const InfoIcon = InfoOutlineRounded;

/**
 * Add/Create icon [+] component with rounded styling for better visibility
 * Used for creation and addition actions
 */
export const AddIcon = AddCircleOutlineRounded;

/**
 * Close/Delete icon [x] component with rounded styling for better visibility
 * Used for closing dialogs and removing items
 */
export const CloseIcon = CloseRounded;

/**
 * Navigation left icon [<] component with rounded styling for better visibility
 * Used for left navigation actions
 */
export const ChevronLeftIcon = ChevronLeftRounded;

/**
 * Navigation right icon [>] component with rounded styling for better visibility
 * Used for right navigation actions
 */
export const ChevronRightIcon = ChevronRightRounded;

/**
 * Upload icon [^] component with rounded styling for better visibility
 * Used for file upload actions
 */
export const UploadIcon = FileUploadRounded;

/**
 * Menu/Dashboard icon [#] component with rounded styling for better visibility
 * Used for dashboard and menu indicators
 */
export const DashboardIcon = DashboardRounded;

/**
 * User Profile icon [@] component with rounded styling for better visibility
 * Used for user profile related actions and displays
 */
export const ProfileIcon = AccountCircleRounded;

/**
 * Warning icon [!] component with rounded styling for better visibility
 * Used for warning messages and alerts
 */
export const WarningIcon = WarningRounded;

/**
 * Settings icon [=] component with rounded styling for better visibility
 * Used for configuration and settings actions
 */
export const SettingsIcon = SettingsRounded;

/**
 * Favorite icon [*] component with rounded styling for better visibility
 * Used for favorite/bookmark actions and indicators
 */
export const FavoriteIcon = StarRounded;

// Type exports for TypeScript support
export type IconComponent = typeof HelpOutlineRounded;