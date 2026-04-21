import { useState, useCallback, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Member, Expense, Settlement } from '@/types/expense';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';

export function useExpenseSplitter(groupId?: string) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper: apply group data from API response
  const applyGroupData = useCallback((data: any) => {
    setMembers(data.members || []);
    setExpenses((data.expenses || []).map((e: any) => ({
      ...e,
      createdAt: new Date(e.createdAt),
    })));
  }, []);

  // Fetch group data from API
  const fetchGroup = useCallback(async () => {
    if (!user || !groupId) return;
    try {
      const data = await api.get(`/groups/${groupId}`);
      applyGroupData(data);
    } catch (error) {
      console.error('Failed to fetch group:', error);
    } finally {
      setLoading(false);
    }
  }, [user, groupId, applyGroupData]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const addMember = useCallback(async (name: string, email?: string) => {
    if (!user || !groupId) return false;
    const trimmed = name.trim();
    if (!trimmed || members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    const isCurrentUser = user && (
      name.toLowerCase() === 'me' ||
      name.toLowerCase() === (user.email?.split('@')[0].toLowerCase() ?? '') ||
      name.toLowerCase() === (user.displayName?.toLowerCase() ?? '')
    );

    try {
      const group = await api.post(`/groups/${groupId}/members`, {
        name: trimmed,
        email: isCurrentUser ? (user.email || email?.trim() || undefined) : (email?.trim() || undefined),
        userId: isCurrentUser ? user.uid : undefined,
      });
      applyGroupData(group);
      return true;
    } catch (error) {
      console.error('Failed to add member:', error);
      return false;
    }
  }, [user, groupId, members, applyGroupData]);

  const updateMember = useCallback(async (memberId: string, updates: Partial<Member>) => {
    if (!user || !groupId) return;

    try {
      const group = await api.put(`/groups/${groupId}/members/${memberId}`, {
        name: updates.name,
        email: updates.email,
        upiId: updates.upiId,
      });
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  }, [user, groupId, applyGroupData]);

  const removeMember = useCallback(async (id: string) => {
    if (!user || !groupId) return;

    try {
      const group = await api.delete(`/groups/${groupId}/members/${id}`);
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  }, [user, groupId, applyGroupData]);

  const addExpense = useCallback(async (payerId: string, amount: number, note: string, receiptUrl?: string, splitType: 'equal' | 'unequal' = 'equal', splits?: Record<string, number>) => {
    if (!user || !groupId) return;

    try {
      const group = await api.post(`/groups/${groupId}/expenses`, {
        payerId,
        amount,
        note: note.trim(),
        receiptUrl: receiptUrl || undefined,
        splitType,
        splits: splits || undefined,
      });
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to add expense:', error);
    }
  }, [user, groupId, applyGroupData]);

  const addSettlement = useCallback(async (payerId: string, receiverId: string, amount: number) => {
    if (!user || !groupId) return;

    try {
      const group = await api.post(`/groups/${groupId}/expenses`, {
        payerId,
        amount,
        note: 'Settlement Payment',
        type: 'settlement',
        relatedMemberId: receiverId,
      });
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to add settlement:', error);
    }
  }, [user, groupId, applyGroupData]);

  const editExpense = useCallback(async (id: string, payerId: string, amount: number, note: string, receiptUrl?: string, splitType: 'equal' | 'unequal' = 'equal', splits?: Record<string, number>) => {
    if (!user || !groupId) return;

    try {
      const group = await api.put(`/groups/${groupId}/expenses/${id}`, {
        payerId,
        amount,
        note: note.trim(),
        receiptUrl: receiptUrl || undefined,
        splitType,
        splits: splitType === 'unequal' ? splits : undefined,
      });
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to edit expense:', error);
    }
  }, [user, groupId, applyGroupData]);

  const removeExpense = useCallback(async (id: string) => {
    if (!user || !groupId) return;

    try {
      const group = await api.delete(`/groups/${groupId}/expenses/${id}`);
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to remove expense:', error);
    }
  }, [user, groupId, applyGroupData]);

  const resetMonth = useCallback(async () => {
    if (!user || !groupId || members.length === 0) return;

    try {
      const group = await api.post(`/groups/${groupId}/reset-month`);
      applyGroupData(group);
    } catch (error) {
      console.error('Failed to reset month:', error);
    }
  }, [user, groupId, members, applyGroupData]);

  // ─── All computation logic below is UNCHANGED from original ───

  const balances = useMemo(() => {
    if (members.length === 0) return [];

    const balanceMap = new Map<string, number>();
    members.forEach(m => balanceMap.set(m.id, 0));

    // Only count 'expense' types for the total group cost
    const normalExpenses = expenses.filter(e => e.type !== 'settlement');
    const totalGroupCost = normalExpenses.reduce((sum, e) => sum + e.amount, 0);
    const share = members.length > 0 ? totalGroupCost / members.length : 0;

    expenses.forEach(e => {
      if (e.type === 'settlement') {
        // Settlement Logic: Payer pays Receiver.
        if (e.relatedMemberId) {
          const payerBal = balanceMap.get(e.payerId) ?? 0;
          const receiverBal = balanceMap.get(e.relatedMemberId) ?? 0;
          balanceMap.set(e.payerId, payerBal + e.amount);
          balanceMap.set(e.relatedMemberId, receiverBal - e.amount);
        }
      } else {
        // Expense Logic
        // 1. Payer gets positive balance (they paid, so they are owed)
        const currentPayerBal = balanceMap.get(e.payerId) ?? 0;
        balanceMap.set(e.payerId, currentPayerBal + e.amount);

        // 2. Subtract liability from everyone
        if (e.splitType === 'unequal' && e.splits) {
          // Unequal split: Subtract specific amount from each member's balance
          Object.entries(e.splits).forEach(([memberId, splitAmount]) => {
            const currentBal = balanceMap.get(memberId) ?? 0;
            balanceMap.set(memberId, currentBal - splitAmount);
          });

          // Handle any rounding errors or missing splits if total != sum(splits)? 
          // We assume validation on entry ensures they match reasonably well.
        } else {
          // Equal split (default): Subtract share from everyone
          // Note: If we add new members LATER, they shouldn't retroactively owe for old equal expenses?
          // The current architecture calculates balances on the fly based on current members. 
          // This implies if a new member joins, they split OLD expenses too if we use members.length.
          // Ideally we should snapshot members at expense creation, but simpler for now:
          // We divide by current members.length.
          const share = members.length > 0 ? e.amount / members.length : 0;
          members.forEach(m => {
            const bal = balanceMap.get(m.id) ?? 0;
            balanceMap.set(m.id, bal - share);
          });
        }
      }
    });

    return members.map(m => ({
      ...m,
      balance: balanceMap.get(m.id) ?? 0,
    }));
  }, [members, expenses]);

  const settlements = useMemo((): Settlement[] => {
    const result: Settlement[] = [];
    const debtors: { id: string; name: string; amount: number }[] = [];
    const creditors: { id: string; name: string; amount: number }[] = [];

    balances.forEach(b => {
      if (b.balance < -0.01) {
        debtors.push({ id: b.id, name: b.name, amount: -b.balance });
      } else if (b.balance > 0.01) {
        creditors.push({ id: b.id, name: b.name, amount: b.balance });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);

      if (amount > 0.01) {
        result.push({
          from: debtor.name,
          fromId: debtor.id,
          to: creditor.name,
          toId: creditor.id,
          amount: Math.round(amount * 100) / 100,
        });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return result;
  }, [balances]);

  const totalSpent = useMemo(() =>
    expenses
      .filter(e => e.type !== 'settlement')
      .reduce((sum, e) => sum + e.amount, 0),
    [expenses]);

  const spendingByMember = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      // Include EVERYTHING (Expenses + Settlements)
      const current = map.get(e.payerId) ?? 0;
      map.set(e.payerId, current + e.amount);

      // Subtract if receiving settlement
      if (e.type === 'settlement' && e.relatedMemberId) {
        const receiverCurrent = map.get(e.relatedMemberId) ?? 0;
        map.set(e.relatedMemberId, receiverCurrent - e.amount);
      }
    });

    return members.map(m => ({
      name: m.name,
      amount: map.get(m.id) ?? 0,
    }));
  }, [members, expenses]);

  return {
    members,
    expenses,
    balances,
    settlements,
    totalSpent,
    spendingByMember,
    loading,
    addMember,
    removeMember,
    addExpense,
    editExpense,
    addSettlement,
    updateMember,
    removeExpense,
    resetMonth
  };
}
