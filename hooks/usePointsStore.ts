import { useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { RewardsService, RewardTask, PointsTransaction } from '@/lib/rewards-service';
import { trpcClient } from '@/lib/trpc';
import { AD_REWARD_DAILY_CAP } from '@/lib/ad-rewards-config';

export const [PointsProvider, usePoints] = createContextHook(() => {
  const [balance, setBalance] = useState(0);
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [adRewardsRemainingToday, setAdRewardsRemainingToday] = useState(AD_REWARD_DAILY_CAP);

  const loadPoints = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const [bal, taskList, history, completed] = await Promise.all([
        RewardsService.getPointsBalance(userId),
        RewardsService.getTasks(),
        RewardsService.getPointsHistory(userId),
        RewardsService.getUserCompletions(userId),
      ]);
      setBalance(bal);
      setTasks(taskList);
      setTransactions(history);
      setCompletedTaskIds(completed);
    } catch (error) {
      console.error('Error loading points:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const claimReward = useCallback(async (userId: string, taskId: string, points: number) => {
    await RewardsService.claimTaskReward(userId, taskId, points);
    setBalance(prev => prev + points);
    setCompletedTaskIds(prev => [...prev, taskId]);
    const history = await RewardsService.getPointsHistory(userId);
    setTransactions(history);
  }, []);

  const redeemForRide = useCallback(async (userId: string, points: number, rideId: string) => {
    await RewardsService.redeemPoints(userId, points, rideId);
    setBalance(prev => prev - points);
    const history = await RewardsService.getPointsHistory(userId);
    setTransactions(history);
  }, []);

  const loadAdRewardStatus = useCallback(async () => {
    try {
      const status = await trpcClient.rewards.getAdRewardStatus.query();
      setAdRewardsRemainingToday(status.remainingToday);
    } catch (error) {
      console.error('Error loading ad reward status:', error);
    }
  }, []);

  const claimAdReward = useCallback(async (userId: string) => {
    const result = await trpcClient.rewards.claimAdReward.mutate();
    setBalance(prev => prev + result.pointsEarned);
    setAdRewardsRemainingToday(result.remainingToday);
    const history = await RewardsService.getPointsHistory(userId);
    setTransactions(history);
    return result;
  }, []);

  /** NGN value of the current balance */
  const balanceNGN = balance * RewardsService.POINTS_TO_NGN;

  return {
    balance,
    balanceNGN,
    tasks,
    transactions,
    completedTaskIds,
    isLoading,
    adRewardsRemainingToday,
    loadPoints,
    claimReward,
    redeemForRide,
    loadAdRewardStatus,
    claimAdReward,
  };
});
