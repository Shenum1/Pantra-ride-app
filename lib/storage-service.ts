import { supabase } from './supabase';

const AVATARS_BUCKET = 'avatars';
const DOCUMENTS_BUCKET = 'documents';

export class StorageService {
  static async uploadImage(path: string, uri: string): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, uint8Array, { upsert: true, contentType: blob.type || 'image/jpeg' });

    if (error) throw new Error(error.message);
    return this.getPublicUrl(path);
  }

  static async uploadBase64(path: string, base64Data: string): Promise<string> {
    const byteCharacters = atob(base64Data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, byteArray, { upsert: true, contentType: 'image/jpeg' });

    if (error) throw new Error(error.message);
    return this.getPublicUrl(path);
  }

  static async deleteFile(path: string): Promise<void> {
    const { error } = await supabase.storage.from(AVATARS_BUCKET).remove([path]);
    if (error) throw new Error(error.message);
  }

  static getPublicUrl(path: string): string {
    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  static async uploadFile(uri: string, path: string): Promise<string> {
    return this.uploadImage(path, uri);
  }

  // Uploads to the private "documents" bucket and returns the storage path
  // (not a public URL — the bucket is not publicly readable).
  static async uploadPrivateFile(uri: string, path: string): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, uint8Array, { upsert: true, contentType: blob.type || 'image/jpeg' });

    if (error) throw new Error(error.message);
    return path;
  }

  static async getDownloadURL(path: string): Promise<string> {
    return this.getPublicUrl(path);
  }
}
