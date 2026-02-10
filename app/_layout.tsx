import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { MD3LightTheme, PaperProvider } from 'react-native-paper';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const paperTheme = {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: "#1e88e5",
      secondary: "#43a047",
    },
  };

  return (
    <PaperProvider theme={paperTheme}>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="position/[symbol]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </NavThemeProvider>
    </PaperProvider>
  );
}
