import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Group } from '@/types/expense';
import { useAuth } from '@/components/AuthContext';

export function useGroups() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch groups from API
    const fetchGroups = useCallback(async () => {
        if (!user) return;
        try {
            const data = await api.get<any[]>('/groups');
            const parsed = data.map((g: any) => ({
                ...g,
                createdAt: new Date(g.createdAt),
                expenses: (g.expenses || []).map((e: any) => ({
                    ...e,
                    createdAt: new Date(e.createdAt),
                })),
            })) as Group[];
            setGroups(parsed);
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    const createGroup = useCallback(async (name: string, description?: string, type: 'trip' | 'household' = 'trip') => {
        if (!user) return;
        await api.post('/groups', { name, description: description || '', type });
        await fetchGroups();
    }, [user, fetchGroups]);

    const deleteGroup = useCallback(async (groupId: string) => {
        await api.delete(`/groups/${groupId}`);
        await fetchGroups();
    }, [fetchGroups]);

    const updateGroupStatus = useCallback(async (groupId: string, isSettled: boolean) => {
        await api.patch(`/groups/${groupId}`, { isSettled });
        await fetchGroups();
    }, [fetchGroups]);

    const updateGroupBudget = useCallback(async (groupId: string, budget: number) => {
        await api.patch(`/groups/${groupId}`, { budget });
        await fetchGroups();
    }, [fetchGroups]);

    return {
        groups,
        loading,
        createGroup,
        deleteGroup,
        updateGroupStatus,
        updateGroupBudget,
    };
}
