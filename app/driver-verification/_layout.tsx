import React from 'react';
import { Stack } from 'expo-router';
import { DriverVerificationWizardProvider } from './_wizard-context';

export default function DriverVerificationLayout() {
  return (
    <DriverVerificationWizardProvider>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="credentials" options={{ title: 'Step 2 of 3 · Driver Credentials' }} />
        <Stack.Screen name="vehicle" options={{ title: 'Step 3 of 3 · Vehicle Information' }} />
        <Stack.Screen name="review-submit" options={{ title: 'Review' }} />
      </Stack>
    </DriverVerificationWizardProvider>
  );
}
