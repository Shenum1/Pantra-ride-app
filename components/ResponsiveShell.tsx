import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/useThemeStore';

const MAX_CONTENT_WIDTH = 560;

interface ResponsiveShellProps {
  children: React.ReactNode;
}

// Native is untouched — this only changes layout on web, where the app would
// otherwise stretch full-bleed edge-to-edge on wide desktop windows.
export function ResponsiveShell({ children }: ResponsiveShellProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return <WebShell>{children}</WebShell>;
}

function WebShell({ children }: ResponsiveShellProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.outer, { backgroundColor: colors.card }]}>
      <View style={[styles.inner, { borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
