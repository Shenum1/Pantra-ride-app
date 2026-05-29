import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { DeviceSecurityService, DeviceFingerprint } from '@/lib/device-security-service';

export const [DeviceSecurityProvider, useDeviceSecurity] = createContextHook(() => {
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEligible, setIsEligible] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState<string>('');

  useEffect(() => {
    initializeDevice();
  }, []);

  const initializeDevice = async () => {
    try {
      setIsLoading(true);
      
      let fingerprint = await DeviceSecurityService.getStoredFingerprint();
      
      if (!fingerprint) {
        fingerprint = await DeviceSecurityService.generateDeviceFingerprint();
      }
      
      setDeviceFingerprint(fingerprint);
      
      const eligibility = await DeviceSecurityService.checkDeviceEligibility(fingerprint);
      setIsEligible(eligibility.eligible);
      setEligibilityMessage(eligibility.reason || '');
      
      console.log('Device initialized:', {
        deviceId: fingerprint.deviceId,
        eligible: eligibility.eligible,
        accountsCreated: eligibility.accountsCreated,
        referralsClaimed: eligibility.referralsClaimed,
      });
    } catch (error) {
      console.error('Error initializing device:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const registerDevice = async (userId: string) => {
    if (!deviceFingerprint) {
      throw new Error('Device fingerprint not initialized');
    }
    
    try {
      await DeviceSecurityService.registerDevice(deviceFingerprint, userId);
      await initializeDevice();
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  };

  const claimReferralBonus = async (userId: string, referralCode: string) => {
    if (!deviceFingerprint) {
      throw new Error('Device fingerprint not initialized');
    }
    
    try {
      const result = await DeviceSecurityService.claimReferralBonus(
        deviceFingerprint,
        userId,
        referralCode
      );
      
      if (result.success) {
        await initializeDevice();
      }
      
      return result;
    } catch (error) {
      console.error('Error claiming referral bonus:', error);
      throw error;
    }
  };

  const checkEligibility = async () => {
    if (!deviceFingerprint) {
      return {
        eligible: false,
        reason: 'Device not initialized',
        accountsCreated: 0,
        referralsClaimed: 0,
      };
    }
    
    return await DeviceSecurityService.checkDeviceEligibility(deviceFingerprint);
  };

  const detectSuspiciousActivity = async (userId: string) => {
    return await DeviceSecurityService.detectSuspiciousActivity(userId);
  };

  return {
    deviceFingerprint,
    isLoading,
    isEligible,
    eligibilityMessage,
    registerDevice,
    claimReferralBonus,
    checkEligibility,
    detectSuspiciousActivity,
    refreshEligibility: initializeDevice,
  };
});
