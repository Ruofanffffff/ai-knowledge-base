import apiClient from './client';
import { Document } from './types';

/**
 * File Upload API Service
 * 
 * Handles file uploads to the backend with progress tracking.
 * Supports multipart/form-data uploads with real-time progress callbacks.
 * 
 * The backend endpoint processes the uploaded file and returns
 * a Document object representing the newly created document.
 */
export const uploadApi = {
  /**
   * Upload file to the server
   * POST /api/upload
   * 
   * @param file - File object to upload
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Document object for the uploaded file
   * @throws Error if upload fails
   * 
   * @example
   * ```typescript
   * const file = event.target.files[0];
   * const document = await uploadApi.uploadFile(file, (progress) => {
   *   console.log(`Upload progress: ${progress}%`);
   * });
   * ```
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Document> {
    // Create FormData and append the file
    const formData = new FormData();
    formData.append('file', file);
    
    // Make POST request with multipart/form-data
    const response = await apiClient.post<Document>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        // Calculate and report progress percentage
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    
    return response.data;
  },
};
