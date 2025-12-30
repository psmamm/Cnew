import { Theme } from '../contexts/ThemeContext';

/**
 * Get theme-aware background color classes
 */
export function getCardBg(theme: Theme): string {
  return theme === 'dark' 
    ? 'bg-[#0D0F18]' 
    : 'bg-white';
}

/**
 * Get theme-aware border color classes
 */
export function getCardBorder(theme: Theme): string {
  return theme === 'dark' 
    ? 'border-white/10' 
    : 'border-gray-200';
}

/**
 * Get theme-aware text color classes
 */
export function getTextColor(theme: Theme, variant: 'primary' | 'secondary' | 'muted' = 'primary'): string {
  if (theme === 'dark') {
    switch (variant) {
      case 'primary': return 'text-white';
      case 'secondary': return 'text-[#BDC3C7]';
      case 'muted': return 'text-[#7F8C8D]';
      default: return 'text-white';
    }
  } else {
    switch (variant) {
      case 'primary': return 'text-gray-900';
      case 'secondary': return 'text-gray-700';
      case 'muted': return 'text-gray-500';
      default: return 'text-gray-900';
    }
  }
}

/**
 * Get theme-aware hover background classes
 */
export function getHoverBg(theme: Theme): string {
  return theme === 'dark' 
    ? 'hover:bg-white/5' 
    : 'hover:bg-gray-50';
}

/**
 * Get theme-aware card classes
 */
export function getCardClasses(theme: Theme): string {
  return `${getCardBg(theme)} ${getCardBorder(theme)} rounded-xl p-4 border`;
}
