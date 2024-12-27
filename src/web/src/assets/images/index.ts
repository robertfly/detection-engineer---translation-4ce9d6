/**
 * @fileoverview Central index file for managing and exporting image assets
 * Implements Material Design 3.0 specifications with theme and responsive support
 * @version 1.0.0
 */

/**
 * Enum defining supported themes for image assets
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

/**
 * Enhanced interface defining image asset metadata with theme and responsive support
 */
export interface ImageAsset {
  path: string;
  alt: string;
  width: number;
  height: number;
  theme?: Theme;
  formats: string[];
  sizes: Record<string, { width: number; height: number }>;
}

/**
 * Comprehensive mapping of all image assets with theme and format variants
 */
const IMAGE_PATHS: Record<string, {
  light: string;
  dark?: string;
  formats: Record<string, string>;
  sizes: Record<string, string>;
}> = {
  appLogo: {
    light: '/images/logo/logo-light.png',
    dark: '/images/logo/logo-dark.png',
    formats: {
      png: '/images/logo/logo-{theme}.png',
      webp: '/images/logo/logo-{theme}.webp',
      svg: '/images/logo/logo-{theme}.svg'
    },
    sizes: {
      small: '/images/logo/logo-{theme}-small.{format}',
      medium: '/images/logo/logo-{theme}-medium.{format}',
      large: '/images/logo/logo-{theme}-large.{format}'
    }
  },
  loginBackground: {
    light: '/images/backgrounds/login-bg-light.jpg',
    dark: '/images/backgrounds/login-bg-dark.jpg',
    formats: {
      jpg: '/images/backgrounds/login-bg-{theme}.jpg',
      webp: '/images/backgrounds/login-bg-{theme}.webp'
    },
    sizes: {
      mobile: '/images/backgrounds/login-bg-{theme}-mobile.{format}',
      tablet: '/images/backgrounds/login-bg-{theme}-tablet.{format}',
      desktop: '/images/backgrounds/login-bg-{theme}-desktop.{format}'
    }
  },
  emptyStateIllustration: {
    light: '/images/illustrations/empty-state-light.svg',
    dark: '/images/illustrations/empty-state-dark.svg',
    formats: {
      svg: '/images/illustrations/empty-state-{theme}.svg',
      png: '/images/illustrations/empty-state-{theme}.png'
    },
    sizes: {
      default: '/images/illustrations/empty-state-{theme}.{format}'
    }
  },
  errorIllustration: {
    light: '/images/illustrations/error-light.svg',
    formats: {
      svg: '/images/illustrations/error.svg',
      png: '/images/illustrations/error.png'
    },
    sizes: {
      default: '/images/illustrations/error.{format}'
    }
  }
};

/**
 * Helper function to get the full path of an image asset with theme and format support
 * @param imageName - Name of the image asset
 * @param theme - Desired theme variant
 * @param format - Desired image format
 * @param size - Desired size variant
 * @returns Full path to the image asset
 * @throws Error if image, theme, format or size is invalid
 */
export const getImagePath = (
  imageName: string,
  theme: Theme = Theme.LIGHT,
  format: string = 'png',
  size: string = 'default'
): string => {
  const imageConfig = IMAGE_PATHS[imageName];
  if (!imageConfig) {
    throw new Error(`Invalid image name: ${imageName}`);
  }

  if (theme === Theme.DARK && !imageConfig.dark) {
    theme = Theme.LIGHT;
  }

  if (!imageConfig.formats[format]) {
    throw new Error(`Unsupported format ${format} for image ${imageName}`);
  }

  if (!imageConfig.sizes[size]) {
    throw new Error(`Unsupported size ${size} for image ${imageName}`);
  }

  const path = imageConfig.sizes[size]
    .replace('{theme}', theme)
    .replace('{format}', format);

  return path;
};

/**
 * Application logo asset with theme support
 */
export const appLogo: ImageAsset = {
  path: getImagePath('appLogo'),
  alt: 'Detection Translator Platform Logo',
  width: 180,
  height: 40,
  formats: ['png', 'webp', 'svg'],
  sizes: {
    small: { width: 120, height: 27 },
    medium: { width: 180, height: 40 },
    large: { width: 240, height: 53 }
  }
};

/**
 * Dark theme variant of application logo
 */
export const appLogoDark: ImageAsset = {
  ...appLogo,
  path: getImagePath('appLogo', Theme.DARK),
  theme: Theme.DARK
};

/**
 * Responsive background image for login page
 */
export const loginBackground: ImageAsset = {
  path: getImagePath('loginBackground'),
  alt: 'Login Page Background',
  width: 1920,
  height: 1080,
  formats: ['jpg', 'webp'],
  sizes: {
    mobile: { width: 768, height: 432 },
    tablet: { width: 1024, height: 576 },
    desktop: { width: 1920, height: 1080 }
  }
};

/**
 * Empty state illustration with theme support
 */
export const emptyStateIllustration: ImageAsset = {
  path: getImagePath('emptyStateIllustration'),
  alt: 'No items to display',
  width: 400,
  height: 300,
  formats: ['svg', 'png'],
  sizes: {
    default: { width: 400, height: 300 }
  }
};

/**
 * Error state illustration
 */
export const errorIllustration: ImageAsset = {
  path: getImagePath('errorIllustration'),
  alt: 'An error has occurred',
  width: 400,
  height: 300,
  formats: ['svg', 'png'],
  sizes: {
    default: { width: 400, height: 300 }
  }
};