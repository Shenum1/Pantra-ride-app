import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { EarnTask, UserEarnings, PointsTransaction } from '@/types';
import { earnTasks, pointsToRideConversion } from '@/mocks/earnTasks';
import { DeviceSecurityService } from '@/lib/device-security-service';

const EARNINGS_STORAGE_KEY = 'user_earnings';
const TASKS_STORAGE_KEY = 'earn_tasks';
const TRANSACTIONS_STORAGE_KEY = 'points_transactions';

export const [EarnProvider, useEarn] = createContextHook(() => {
  const [tasks, setTasks] = useState<EarnTask[]>(earnTasks);
  const [userEarnings, setUserEarnings] = useState<UserEarnings>({
    totalPoints: 0,
    availablePoints: 0,
    usedPoints: 0,
    completedTasks: 0,
    freeRidesEarned: 0,
    currentStreak: 0,
    lastActivity: new Date()
  });
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load user earnings
      const earningsData = await AsyncStorage.getItem(EARNINGS_STORAGE_KEY);
      if (earningsData) {
        const earnings = JSON.parse(earningsData);
        setUserEarnings({
          ...earnings,
          lastActivity: new Date(earnings.lastActivity)
        });
      }

      // Load tasks
      const tasksData = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
      if (tasksData) {
        const savedTasks = JSON.parse(tasksData);
        const updatedTasks = savedTasks.map((task: any) => ({
          ...task,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          expiresAt: task.expiresAt ? new Date(task.expiresAt) : undefined
        }));
        setTasks(updatedTasks);
      }

      // Load transactions
      const transactionsData = await AsyncStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (transactionsData) {
        const savedTransactions = JSON.parse(transactionsData);
        const updatedTransactions = savedTransactions.map((transaction: any) => ({
          ...transaction,
          createdAt: new Date(transaction.createdAt)
        }));
        setTransactions(updatedTransactions);
      }
    } catch (error) {
      console.error('Error loading earn data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async (newEarnings: UserEarnings, newTasks: EarnTask[], newTransactions: PointsTransaction[]) => {
    try {
      await AsyncStorage.setItem(EARNINGS_STORAGE_KEY, JSON.stringify(newEarnings));
      await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(newTasks));
      await AsyncStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(newTransactions));
    } catch (error) {
      console.error('Error saving earn data:', error);
    }
  };

  const completeTask = async (taskId: string, userId?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.isCompleted) return;

    if (task.id === 'signup_bonus' && userId) {
      const deviceFingerprint = await DeviceSecurityService.generateDeviceFingerprint();
      const eligibility = await DeviceSecurityService.checkDeviceEligibility(deviceFingerprint);
      
      if (!eligibility.eligible || eligibility.accountsCreated > 0) {
        throw new Error('Sign-up bonus can only be claimed once per device');
      }
    }

    const updatedTasks = tasks.map(t => 
      t.id === taskId 
        ? { ...t, isCompleted: true, completedAt: new Date() }
        : t
    );

    const newEarnings = {
      ...userEarnings,
      totalPoints: userEarnings.totalPoints + task.points,
      availablePoints: userEarnings.availablePoints + task.points,
      completedTasks: userEarnings.completedTasks + 1,
      lastActivity: new Date()
    };

    const newTransaction: PointsTransaction = {
      id: Date.now().toString(),
      type: 'earned',
      points: task.points,
      description: `Completed: ${task.title}`,
      taskId: task.id,
      createdAt: new Date()
    };

    const updatedTransactions = [newTransaction, ...transactions];

    setTasks(updatedTasks);
    setUserEarnings(newEarnings);
    setTransactions(updatedTransactions);

    await saveData(newEarnings, updatedTasks, updatedTransactions);
  };

  const redeemFreeRide = async () => {
    if (userEarnings.availablePoints < pointsToRideConversion.freeRidePoints) {
      throw new Error('Insufficient points for free ride');
    }

    const pointsToDeduct = pointsToRideConversion.freeRidePoints;
    const newEarnings = {
      ...userEarnings,
      availablePoints: userEarnings.availablePoints - pointsToDeduct,
      usedPoints: userEarnings.usedPoints + pointsToDeduct,
      freeRidesEarned: userEarnings.freeRidesEarned + 1,
      lastActivity: new Date()
    };

    const newTransaction: PointsTransaction = {
      id: Date.now().toString(),
      type: 'redeemed',
      points: pointsToDeduct,
      description: 'Redeemed free ride',
      createdAt: new Date()
    };

    const updatedTransactions = [newTransaction, ...transactions];

    setUserEarnings(newEarnings);
    setTransactions(updatedTransactions);

    await saveData(newEarnings, tasks, updatedTransactions);
  };

  const getAvailableTasks = () => {
    return tasks.filter(task => !task.isCompleted && (!task.expiresAt || task.expiresAt > new Date()));
  };

  const getCompletedTasks = () => {
    return tasks.filter(task => task.isCompleted);
  };

  const getTasksByCategory = (category: EarnTask['category']) => {
    return getAvailableTasks().filter(task => task.category === category);
  };

  const canRedeemFreeRide = () => {
    return userEarnings.availablePoints >= pointsToRideConversion.freeRidePoints;
  };

  const getDiscountTier = () => {
    const availablePoints = userEarnings.availablePoints;
    return pointsToRideConversion.discountTiers
      .filter(tier => availablePoints >= tier.points)
      .sort((a, b) => b.discount - a.discount)[0];
  };

  const resetDailyTasks = async () => {
    const today = new Date();
    const lastActivity = new Date(userEarnings.lastActivity);
    
    // Check if it's a new day
    if (today.toDateString() !== lastActivity.toDateString()) {
      const updatedTasks = tasks.map(task => 
        task.type === 'daily_check' 
          ? { ...task, isCompleted: false, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
          : task
      );
      
      setTasks(updatedTasks);
      await saveData(userEarnings, updatedTasks, transactions);
    }
  };

  // Reset daily tasks when component mounts
  useEffect(() => {
    if (!isLoading) {
      resetDailyTasks();
    }
  }, [isLoading]);

  const checkSignupBonusEligibility = async (): Promise<boolean> => {
    try {
      const deviceFingerprint = await DeviceSecurityService.generateDeviceFingerprint();
      const eligibility = await DeviceSecurityService.checkDeviceEligibility(deviceFingerprint);
      
      return eligibility.eligible && eligibility.accountsCreated === 0;
    } catch (error) {
      console.error('Error checking signup bonus eligibility:', error);
      return false;
    }
  };

  return {
    tasks,
    userEarnings,
    transactions,
    isLoading,
    completeTask,
    redeemFreeRide,
    getAvailableTasks,
    getCompletedTasks,
    getTasksByCategory,
    canRedeemFreeRide,
    getDiscountTier,
    checkSignupBonusEligibility,
    pointsToRideConversion
  };
});