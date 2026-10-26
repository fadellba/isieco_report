export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface DesignTokens {
  background: string;
  surface: string;
  surfaceRaised: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySubtle: string;
  brandGreen: string;
  brandYellow: string;
  brandRed: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  infoSurface: string;
}

export const DESIGN_TOKENS: Record<ResolvedTheme, DesignTokens> = {
  light: {
    background: '#F6F8F5',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    textPrimary: '#17231B',
    textSecondary: '#526056',
    border: '#D7E0D8',
    primary: '#087443',
    onPrimary: '#FFFFFF',
    primarySubtle: '#EAF5ED',
    brandGreen: '#00853F',
    brandYellow: '#FDEF42',
    brandRed: '#E31B23',
    success: '#166534',
    successSurface: '#EAF5ED',
    warning: '#422006',
    warningSurface: '#FEF7D1',
    danger: '#B42318',
    dangerSurface: '#FEF2F1',
    info: '#155E75',
    infoSurface: '#E8F4F8',
  },
  dark: {
    background: '#0B1510',
    surface: '#111E16',
    surfaceRaised: '#18251D',
    textPrimary: '#F1F5F2',
    textSecondary: '#A8B5AC',
    border: '#34443A',
    primary: '#4ADE80',
    onPrimary: '#0B1510',
    primarySubtle: '#14251B',
    brandGreen: '#48C58B',
    brandYellow: '#FDEF42',
    brandRed: '#E31B23',
    success: '#4ADE80',
    successSurface: '#14251B',
    warning: '#FCD34D',
    warningSurface: '#2B2418',
    danger: '#FDA29B',
    dangerSurface: '#321D1B',
    info: '#7DD3FC',
    infoSurface: '#172A30',
  },
};
