import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a signed URL for private storage buckets
 * @param bucket - The storage bucket name
 * @param filePath - The file path within the bucket
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if error
 */
export const getSignedFileUrl = async (
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error in getSignedFileUrl:", error);
    return null;
  }
};

/**
 * Extracts the file path from a storage URL or returns the path if already a path
 * @param url - The storage URL or file path
 * @returns File path
 */
export const extractFilePathFromUrl = (url: string): string | null => {
  try {
    // If it's already just a path (not a full URL), return it
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => 
      ['message-attachments', 'avatars', 'ringtones'].includes(part)
    );
    
    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      return null;
    }
    
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    console.error("Error extracting file path:", error);
    return null;
  }
};

/**
 * Gets file type category for media preview
 */
export const getFileCategory = (fileType?: string): 'image' | 'video' | 'audio' | 'document' => {
  if (!fileType) return 'document';
  
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  
  return 'document';
};
