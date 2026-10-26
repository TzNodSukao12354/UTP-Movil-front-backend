import lightTheme from './lightTheme';
import darkTheme from './darkTheme';

export const Colors = {
  light: {
    ...lightTheme.colors,
    tint: lightTheme.colors.primary,
  },
  dark: {
    ...darkTheme.colors,
    tint: darkTheme.colors.primary,
  },
};

export { lightTheme, darkTheme };
export default { lightTheme, darkTheme, Colors };
