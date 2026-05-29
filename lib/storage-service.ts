import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export class StorageService {
  static async uploadImage(path: string, uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error: any) {
      console.error('Upload image error:', error);
      throw new Error(error.message);
    }
  }

  static async uploadBase64(path: string, base64Data: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      await uploadString(storageRef, base64Data, 'base64');
      
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error: any) {
      console.error('Upload base64 error:', error);
      throw new Error(error.message);
    }
  }

  static async deleteFile(path: string): Promise<void> {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error: any) {
      console.error('Delete file error:', error);
      throw new Error(error.message);
    }
  }

  static async getDownloadURL(path: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      return await getDownloadURL(storageRef);
    } catch (error: any) {
      console.error('Get download URL error:', error);
      throw new Error(error.message);
    }
  }

  static async uploadFile(uri: string, path: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error: any) {
      console.error('Upload file error:', error);
      throw new Error(error.message);
    }
  }
}
