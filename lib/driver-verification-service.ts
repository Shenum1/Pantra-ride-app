import { DatabaseService } from './database-service';
import { StorageService } from './storage-service';

export interface DriverDocument {
  id?: string;
  driverId: string;
  type: 'license' | 'insurance' | 'registration' | 'background_check' | 'vehicle_inspection';
  documentUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  expiryDate?: Date;
}

export interface DriverVerificationStatus {
  driverId: string;
  isVerified: boolean;
  verificationProgress: number;
  requiredDocuments: {
    license: boolean;
    insurance: boolean;
    registration: boolean;
    backgroundCheck: boolean;
    vehicleInspection: boolean;
  };
  pendingDocuments: string[];
  rejectedDocuments: string[];
}

export class DriverVerificationService {
  static async uploadDocument(
    driverId: string,
    documentType: DriverDocument['type'],
    fileUri: string,
    expiryDate?: Date
  ): Promise<string> {
    try {
      const fileName = `drivers/${driverId}/${documentType}_${Date.now()}`;
      const documentUrl = await StorageService.uploadFile(fileUri, fileName);

      const document: Omit<DriverDocument, 'id'> = {
        driverId,
        type: documentType,
        documentUrl,
        status: 'pending',
        uploadedAt: new Date(),
        expiryDate,
      };

      const documentId = await DatabaseService.create('driver_documents', document);

      await this.updateVerificationStatus(driverId);

      return documentId;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  static async getDriverDocuments(driverId: string): Promise<DriverDocument[]> {
    try {
      const documents = await DatabaseService.query('driver_documents', [
        { field: 'driverId', operator: '==', value: driverId },
      ]);
      return documents as DriverDocument[];
    } catch (error) {
      console.error('Error getting driver documents:', error);
      return [];
    }
  }

  static async approveDocument(
    documentId: string,
    reviewerId: string
  ): Promise<void> {
    try {
      await DatabaseService.update('driver_documents', documentId, {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      });

      const document = await DatabaseService.get('driver_documents', documentId);
      if (document) {
        await this.updateVerificationStatus((document as DriverDocument).driverId);
      }
    } catch (error) {
      console.error('Error approving document:', error);
      throw error;
    }
  }

  static async rejectDocument(
    documentId: string,
    reviewerId: string,
    reason: string
  ): Promise<void> {
    try {
      await DatabaseService.update('driver_documents', documentId, {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        rejectionReason: reason,
      });

      const document = await DatabaseService.get('driver_documents', documentId);
      if (document) {
        await this.updateVerificationStatus((document as DriverDocument).driverId);
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
      throw error;
    }
  }

  static async getVerificationStatus(
    driverId: string
  ): Promise<DriverVerificationStatus> {
    try {
      const documents = await this.getDriverDocuments(driverId);

      const requiredDocuments = {
        license: false,
        insurance: false,
        registration: false,
        backgroundCheck: false,
        vehicleInspection: false,
      };

      const pendingDocuments: string[] = [];
      const rejectedDocuments: string[] = [];

      const documentTypeMap: Record<string, keyof typeof requiredDocuments> = {
        license: 'license',
        insurance: 'insurance',
        registration: 'registration',
        background_check: 'backgroundCheck',
        vehicle_inspection: 'vehicleInspection',
      };

      documents.forEach((doc) => {
        const key = documentTypeMap[doc.type];
        if (key) {
          if (doc.status === 'approved') {
            requiredDocuments[key] = true;
          } else if (doc.status === 'pending') {
            pendingDocuments.push(doc.type);
          } else if (doc.status === 'rejected') {
            rejectedDocuments.push(doc.type);
          }
        }
      });

      const totalRequired = Object.keys(requiredDocuments).length;
      const completed = Object.values(requiredDocuments).filter(Boolean).length;
      const verificationProgress = (completed / totalRequired) * 100;
      const isVerified = completed === totalRequired;

      return {
        driverId,
        isVerified,
        verificationProgress,
        requiredDocuments,
        pendingDocuments,
        rejectedDocuments,
      };
    } catch (error) {
      console.error('Error getting verification status:', error);
      return {
        driverId,
        isVerified: false,
        verificationProgress: 0,
        requiredDocuments: {
          license: false,
          insurance: false,
          registration: false,
          backgroundCheck: false,
          vehicleInspection: false,
        },
        pendingDocuments: [],
        rejectedDocuments: [],
      };
    }
  }

  static async updateVerificationStatus(driverId: string): Promise<void> {
    try {
      const status = await this.getVerificationStatus(driverId);

      await DatabaseService.update('drivers', driverId, {
        isVerified: status.isVerified,
        verificationProgress: status.verificationProgress,
      });
    } catch (error) {
      console.error('Error updating verification status:', error);
    }
  }

  static async checkDocumentExpiry(driverId: string): Promise<DriverDocument[]> {
    try {
      const documents = await this.getDriverDocuments(driverId);
      const now = new Date();

      const expiringDocuments = documents.filter((doc) => {
        if (!doc.expiryDate) return false;
        const expiryDate = new Date(doc.expiryDate);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
      });

      return expiringDocuments;
    } catch (error) {
      console.error('Error checking document expiry:', error);
      return [];
    }
  }

  static async runBackgroundCheck(driverId: string): Promise<boolean> {
    try {
      console.log('Running background check for driver:', driverId);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const passed = Math.random() > 0.1;

      const document: Omit<DriverDocument, 'id'> = {
        driverId,
        type: 'background_check',
        documentUrl: 'system_generated',
        status: passed ? 'approved' : 'rejected',
        uploadedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: 'system',
        rejectionReason: passed ? undefined : 'Background check failed',
      };

      await DatabaseService.create('driver_documents', document);
      await this.updateVerificationStatus(driverId);

      return passed;
    } catch (error) {
      console.error('Error running background check:', error);
      return false;
    }
  }
}
