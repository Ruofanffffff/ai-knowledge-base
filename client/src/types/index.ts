import { Document } from '../api/types';

export interface Category {
  id: string;
  name: string;
  count: number;
}

export interface DocumentWithSummary extends Document {
  summaries?: Summary[];
}

export interface Summary {
  id: string;
  content: string;
  createdAt: string;
}
