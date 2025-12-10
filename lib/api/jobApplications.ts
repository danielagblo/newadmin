import { JobApplication } from '@/lib/types';
import apiClient from './config';

export const jobApplicationsApi = {
  list: async (params?: any): Promise<JobApplication[] | { results: JobApplication[]; count?: number }> => {
    const response = await apiClient.get<JobApplication[] | { results: JobApplication[]; count?: number }>(
      '/job-applications/',
      { params }
    );
    return response.data as any;
  },

  get: async (id: number): Promise<JobApplication> => {
    const response = await apiClient.get<JobApplication>(`/job-applications/${id}/`);
    return response.data;
  },
};

export default jobApplicationsApi;
