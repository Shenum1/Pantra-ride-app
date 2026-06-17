import { supabase } from './supabase';

export interface RewardTask {
  id: string;
  type: 'youtube_video' | 'social_share';
  title: string;
  description: string;
  url: string | null;
  pointsReward: number;
  minWatchSeconds: number | null;
  maxCompletionsPerUser: number;
  totalMaxCompletions: number | null;
  completedCount: number;
  isActive: boolean;
  validUntil: string | null;
  createdAt: string;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'task_reward' | 'ride_redemption' | 'expiry';
  referenceId: string | null;
  description: string;
  expiresAt: string | null;
  createdAt: string;
}

const POINTS_TO_NGN = 16; // 500 pts = ₦8,000 → 1 pt = ₦16
const POINTS_EXPIRY_DAYS = 90;

export const RewardsService = {
  POINTS_TO_NGN,

  pointsToNGN(points: number): number {
    return points * POINTS_TO_NGN;
  },

  ngnToPoints(naira: number): number {
    return Math.ceil(naira / POINTS_TO_NGN);
  },

  async getTasks(): Promise<RewardTask[]> {
    const { data, error } = await supabase
      .from('reward_tasks')
      .select('*')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as RewardTask[];
  },

  async getUserCompletions(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_task_completions')
      .select('taskId')
      .eq('userId', userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.taskId as string);
  },

  async claimTaskReward(userId: string, taskId: string, points: number): Promise<void> {
    // Check not already claimed
    const { data: existing } = await supabase
      .from('user_task_completions')
      .select('id')
      .eq('userId', userId)
      .eq('taskId', taskId)
      .maybeSingle();

    if (existing) throw new Error('You have already claimed this reward');

    // Insert completion record
    const { error: completionError } = await supabase
      .from('user_task_completions')
      .insert({ userId, taskId, pointsEarned: points });
    if (completionError) throw new Error(completionError.message);

    // Insert earn transaction (expires in 90 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + POINTS_EXPIRY_DAYS);

    const { error: txError } = await supabase
      .from('points_transactions')
      .insert({
        userId,
        amount: points,
        type: 'task_reward',
        referenceId: taskId,
        description: `Task reward — ${points} points`,
        expiresAt: expiresAt.toISOString(),
      });
    if (txError) throw new Error(txError.message);
  },

  async getPointsBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_points_balance')
      .select('balance')
      .eq('userId', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as any)?.balance ?? 0;
  },

  async getPointsHistory(userId: string): Promise<PointsTransaction[]> {
    const { data, error } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as PointsTransaction[];
  },

  async redeemPoints(userId: string, points: number, rideId: string): Promise<void> {
    const balance = await RewardsService.getPointsBalance(userId);
    if (balance < points) throw new Error('Insufficient points balance');

    const { error } = await supabase
      .from('points_transactions')
      .insert({
        userId,
        amount: -points,
        type: 'ride_redemption',
        referenceId: rideId,
        description: `Ride payment — ${points} points (₦${RewardsService.pointsToNGN(points).toLocaleString()})`,
        expiresAt: null,
      });
    if (error) throw new Error(error.message);
  },
};
