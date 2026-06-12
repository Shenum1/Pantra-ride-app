import { EarnTask } from '@/types';

export const earnTasks: EarnTask[] = [
  {
    id: '1',
    title: 'Watch YouTube Video',
    description: 'Watch a 5-minute video about sustainable transportation',
    type: 'video',
    points: 50,
    estimatedTime: 5,
    icon: 'video',
    isCompleted: false,
    category: 'entertainment',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    requirements: ['Watch for at least 3 minutes', 'Like the video']
  },
  {
    id: '2',
    title: 'Follow on Instagram',
    description: 'Follow our official Instagram account @rideapp',
    type: 'social',
    points: 30,
    estimatedTime: 1,
    icon: 'social',
    isCompleted: false,
    category: 'social',
    url: 'https://instagram.com/rideapp',
    requirements: ['Follow the account', 'Like the latest post']
  },
  {
    id: '3',
    title: 'Daily Check-in',
    description: 'Open the app and check in for today',
    type: 'daily_check',
    points: 10,
    estimatedTime: 1,
    icon: 'check',
    isCompleted: false,
    category: 'engagement',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  {
    id: '4',
    title: 'Complete Survey',
    description: 'Share your feedback about our service',
    type: 'survey',
    points: 100,
    estimatedTime: 10,
    icon: 'survey',
    isCompleted: false,
    category: 'engagement',
    requirements: ['Answer all questions', 'Provide detailed feedback']
  },
  {
    id: '5',
    title: 'Refer a Friend',
    description: 'Invite friends to join and earn when they take their first ride',
    type: 'referral',
    points: 200,
    estimatedTime: 5,
    icon: 'referral',
    isCompleted: false,
    category: 'referral',
    requirements: ['Friend must sign up', 'Friend must complete first ride']
  },
  {
    id: '6',
    title: 'Download Partner App',
    description: 'Download our partner food delivery app',
    type: 'app_download',
    points: 75,
    estimatedTime: 3,
    icon: 'app',
    isCompleted: false,
    category: 'engagement',
    url: 'https://play.google.com/store/apps/details?id=com.ubercab',
    requirements: ['Download and install', 'Open the app once']
  },
  {
    id: '7',
    title: 'Watch TikTok Video',
    description: 'Watch and like our latest TikTok video',
    type: 'video',
    points: 40,
    estimatedTime: 2,
    icon: 'music',
    isCompleted: false,
    category: 'entertainment',
    url: 'https://tiktok.com/@rideapp',
    requirements: ['Watch full video', 'Like and share']
  },
  {
    id: '8',
    title: 'Rate Our App',
    description: 'Give us a 5-star rating on the app store',
    type: 'social',
    points: 150,
    estimatedTime: 3,
    icon: 'star',
    isCompleted: false,
    category: 'social',
    requirements: ['Rate 5 stars', 'Write a review']
  }
];

export const pointsToRideConversion = {
  freeRidePoints: 500, // Points needed for a free ride
  discountTiers: [
    { points: 100, discount: 10 }, // 10% off
    { points: 200, discount: 20 }, // 20% off
    { points: 300, discount: 30 }, // 30% off
  ]
};