import React from 'react';
import {
  Video,
  Camera,
  CheckCircle,
  ClipboardList,
  Users,
  Smartphone,
  Music,
  Star,
  Gift,
} from 'lucide-react-native';

const ICON_MAP: Record<string, typeof Video> = {
  video: Video,
  social: Camera,
  check: CheckCircle,
  survey: ClipboardList,
  referral: Users,
  app: Smartphone,
  music: Music,
  star: Star,
};

interface EarnTaskIconProps {
  icon: string;
  size?: number;
  color?: string;
}

export default function EarnTaskIcon({ icon, size = 20, color = '#000' }: EarnTaskIconProps) {
  const IconComponent = ICON_MAP[icon] ?? Gift;
  return <IconComponent size={size} color={color} />;
}
