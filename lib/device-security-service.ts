import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseService } from './database-service';

export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  osName: string;
  osVersion: string;
  modelName: string;
  brand: string;
  manufacturer: string;
  timestamp: number;
}

export interface DeviceRegistration {
  id?: string;
  deviceFingerprint: DeviceFingerprint;
  userId: string;
  registeredAt: any;
  accountsCreated: number;
  referralBonusesClaimed: number;
  isFlagged: boolean;
  flagReason?: string;
}

const DEVICE_STORAGE_KEY = 'device_fingerprint';
const MAX_ACCOUNTS_PER_DEVICE = 1;
const MAX_REFERRAL_CLAIMS_PER_DEVICE = 1;

export class DeviceSecurityService {
  static async generateDeviceFingerprint(): Promise<DeviceFingerprint> {
    try {
      let deviceId = '';
      
      if (Platform.OS === 'android') {
        deviceId = Application.getAndroidId() || '';
      } else if (Platform.OS === 'ios') {
        deviceId = await Application.getIosIdForVendorAsync() || '';
      } else {
        const storedId = await AsyncStorage.getItem('web_device_id');
        if (storedId) {
          deviceId = storedId;
        } else {
          deviceId = `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await AsyncStorage.setItem('web_device_id', deviceId);
        }
      }

      const fingerprint: DeviceFingerprint = {
        deviceId,
        deviceName: (Device.deviceName as string | null) || 'Unknown',
        osName: (Device.osName as string | null) || Platform.OS,
        osVersion: (Device.osVersion as string | null) || 'Unknown',
        modelName: (Device.modelName as string | null) || 'Unknown',
        brand: (Device.brand as string | null) || 'Unknown',
        manufacturer: (Device.manufacturer as string | null) || 'Unknown',
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(fingerprint));
      
      return fingerprint;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      throw error;
    }
  }

  static async getStoredFingerprint(): Promise<DeviceFingerprint | null> {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting stored fingerprint:', error);
      return null;
    }
  }

  static async checkDeviceEligibility(
    deviceFingerprint: DeviceFingerprint
  ): Promise<{
    eligible: boolean;
    reason?: string;
    accountsCreated: number;
    referralsClaimed: number;
  }> {
    try {
      const existingDevices = await DatabaseService.query(
        'device_registrations',
        [{ field: 'deviceFingerprint.deviceId', operator: '==', value: deviceFingerprint.deviceId }]
      );

      if (existingDevices.length === 0) {
        return {
          eligible: true,
          accountsCreated: 0,
          referralsClaimed: 0,
        };
      }

      const deviceReg = existingDevices[0] as DeviceRegistration;

      if (deviceReg.isFlagged) {
        return {
          eligible: false,
          reason: deviceReg.flagReason || 'Device has been flagged for suspicious activity',
          accountsCreated: deviceReg.accountsCreated,
          referralsClaimed: deviceReg.referralBonusesClaimed,
        };
      }

      if (deviceReg.accountsCreated >= MAX_ACCOUNTS_PER_DEVICE) {
        return {
          eligible: false,
          reason: 'Maximum number of accounts reached for this device',
          accountsCreated: deviceReg.accountsCreated,
          referralsClaimed: deviceReg.referralBonusesClaimed,
        };
      }

      if (deviceReg.referralBonusesClaimed >= MAX_REFERRAL_CLAIMS_PER_DEVICE) {
        return {
          eligible: false,
          reason: 'Referral bonus already claimed on this device',
          accountsCreated: deviceReg.accountsCreated,
          referralsClaimed: deviceReg.referralBonusesClaimed,
        };
      }

      return {
        eligible: true,
        accountsCreated: deviceReg.accountsCreated,
        referralsClaimed: deviceReg.referralBonusesClaimed,
      };
    } catch (error) {
      console.error('Error checking device eligibility:', error);
      return {
        eligible: false,
        reason: 'Error checking device eligibility',
        accountsCreated: 0,
        referralsClaimed: 0,
      };
    }
  }

  static async registerDevice(
    deviceFingerprint: DeviceFingerprint,
    userId: string
  ): Promise<void> {
    try {
      const existingDevices = await DatabaseService.query(
        'device_registrations',
        [{ field: 'deviceFingerprint.deviceId', operator: '==', value: deviceFingerprint.deviceId }]
      );

      if (existingDevices.length > 0) {
        const deviceReg = existingDevices[0] as DeviceRegistration;
        await DatabaseService.update('device_registrations', deviceReg.id!, {
          accountsCreated: deviceReg.accountsCreated + 1,
        });
      } else {
        await DatabaseService.create('device_registrations', {
          deviceFingerprint,
          userId,
          accountsCreated: 1,
          referralBonusesClaimed: 0,
          isFlagged: false,
        });
      }
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  static async claimReferralBonus(
    deviceFingerprint: DeviceFingerprint,
    userId: string,
    referralCode: string
  ): Promise<{ success: boolean; message: string; bonusAmount?: number }> {
    try {
      const eligibility = await this.checkDeviceEligibility(deviceFingerprint);

      if (!eligibility.eligible) {
        return {
          success: false,
          message: eligibility.reason || 'Device not eligible for referral bonus',
        };
      }

      const existingDevices = await DatabaseService.query(
        'device_registrations',
        [{ field: 'deviceFingerprint.deviceId', operator: '==', value: deviceFingerprint.deviceId }]
      );

      if (existingDevices.length > 0) {
        const deviceReg = existingDevices[0] as DeviceRegistration;
        await DatabaseService.update('device_registrations', deviceReg.id!, {
          referralBonusesClaimed: deviceReg.referralBonusesClaimed + 1,
        });
      }

      await DatabaseService.create('referral_claims', {
        userId,
        referralCode,
        deviceId: deviceFingerprint.deviceId,
        bonusAmount: 500,
        status: 'approved',
      });

      return {
        success: true,
        message: 'Referral bonus claimed successfully!',
        bonusAmount: 500,
      };
    } catch (error) {
      console.error('Error claiming referral bonus:', error);
      return {
        success: false,
        message: 'Error processing referral bonus',
      };
    }
  }

  static async flagDevice(
    deviceId: string,
    reason: string
  ): Promise<void> {
    try {
      const existingDevices = await DatabaseService.query(
        'device_registrations',
        [{ field: 'deviceFingerprint.deviceId', operator: '==', value: deviceId }]
      );

      if (existingDevices.length > 0) {
        const deviceReg = existingDevices[0] as DeviceRegistration;
        await DatabaseService.update('device_registrations', deviceReg.id!, {
          isFlagged: true,
          flagReason: reason,
        });
      }
    } catch (error) {
      console.error('Error flagging device:', error);
      throw error;
    }
  }

  static async getDeviceHistory(deviceId: string): Promise<any[]> {
    try {
      const registrations = await DatabaseService.query(
        'device_registrations',
        [{ field: 'deviceFingerprint.deviceId', operator: '==', value: deviceId }]
      );

      const claims = await DatabaseService.query(
        'referral_claims',
        [{ field: 'deviceId', operator: '==', value: deviceId }]
      );

      return {
        registrations,
        claims,
      } as any;
    } catch (error) {
      console.error('Error getting device history:', error);
      return [];
    }
  }

  static async detectSuspiciousActivity(userId: string): Promise<{
    suspicious: boolean;
    reasons: string[];
  }> {
    try {
      const reasons: string[] = [];

      const userDevices = await DatabaseService.query(
        'device_registrations',
        [{ field: 'userId', operator: '==', value: userId }]
      );

      if (userDevices.length > 3) {
        reasons.push('Multiple devices registered to same account');
      }

      const recentClaims = await DatabaseService.query(
        'referral_claims',
        [{ field: 'userId', operator: '==', value: userId }],
        'createdAt',
        'desc',
        10
      );

      if (recentClaims.length > 5) {
        reasons.push('Excessive referral claims');
      }

      return {
        suspicious: reasons.length > 0,
        reasons,
      };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return {
        suspicious: false,
        reasons: [],
      };
    }
  }
}
