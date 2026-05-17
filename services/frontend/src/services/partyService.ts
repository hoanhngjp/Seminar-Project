import { apiClient } from './api';
import type { Party } from '../types/domain';

export interface CreatePartyRequest {
  name?: string;
  songId?: string;
}

export async function createParty(req: CreatePartyRequest): Promise<Party> {
  const res = await apiClient.post('/api/v1/parties', req);
  return res.data.data as Party;
}

export async function joinParty(joinCode: string): Promise<Party> {
  const res = await apiClient.post(`/api/v1/parties/${joinCode}/join`);
  return res.data.data as Party;
}
