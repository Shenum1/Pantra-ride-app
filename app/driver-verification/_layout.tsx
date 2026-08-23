import React from 'react';
import { Stack } from 'expo-router';
import { DriverVerificationWizardProvider } from './_wizard-context';

export default function DriverVerificationLayout() {
  return (
    <DriverVerificationWizardProvider>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="personal-info" options={{ title: 'Personal Information' }} />
        <Stack.Screen name="license-info" options={{ title: "Driver's License" }} />
        <Stack.Screen name="vehicle-info" options={{ title: 'Vehicle Information' }} />
        <Stack.Screen name="review-submit" options={{ title: 'Review & Submit' }} />
      </Stack>
    </DriverVerificationWizardProvider>
  );
}
