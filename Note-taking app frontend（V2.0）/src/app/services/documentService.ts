import { api } from './api';

export const documentService = {
  /**
   * Upload and parse a document file
   * @param file The file to upload
   * @param noteId The ID of the note to associate with
   * @returns The parsed text content
   */
  async uploadDocument(file: File, noteId: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'DOCUMENT');
    formData.append('noteId', noteId);

    const response = await api.post('/attachments/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success && response.data.data.analysis) {
      return response.data.data.analysis.textContent || '';
    }
    
    return '';
  }
};
