import React from 'react';
import { Image } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';

export interface VehicleImageProps {
  source: ImageSourcePropType;
  width?: number;
  height?: number;
  testID?: string;
}

export default function VehicleImage({
  source,
  width = 72,
  height = 44,
  testID,
}: VehicleImageProps) {
  return (
    <Image
      source={source}
      style={{ width, height }}
      contentFit="contain"
      transition={150}
      testID={testID}
    />
  );
}
