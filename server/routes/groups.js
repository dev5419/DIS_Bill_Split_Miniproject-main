import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/mysql.js';

const router = Router();

// ─── Helper: Fetch a complete group with members + expenses ───
async function fetchGroupById(groupId) {
  const [groupRows] = await pool.query('SELECT * FROM user_groups WHERE id = ?', [groupId]);
  if (groupRows.length === 0) return null;

  const group = groupRows[0];

  const [members] = await pool.query(
    'SELECT * FROM group_members WHERE group_id = ?',
    [groupId]
  );

  const [expenses] = await pool.query(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY created_at ASC',
    [groupId]
  );

  // Fetch splits for unequal-split expenses
  const unequalExpenseIds = expenses
    .filter(e => e.split_type === 'unequal')
    .map(e => e.id);

  let splitsMap = {};
  if (unequalExpenseIds.length > 0) {
    const [splits] = await pool.query(
      'SELECT * FROM expense_splits WHERE expense_id IN (?)',
      [unequalExpenseIds]
    );
    splits.forEach(s => {
      if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = {};
      splitsMap[s.expense_id][s.member_id] = parseFloat(s.amount);
    });
  }

  return formatGroup(group, members, expenses, splitsMap);
}

function formatGroup(group, members, expenses, splitsMap = {}) {
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    createdAt: group.created_at,
    createdBy: group.created_by,
    members: members.map(m => ({
      id: m.id,
      name: m.name,
      balance: parseFloat(m.balance) || 0,
      userId: m.user_id || undefined,
      email: m.email || undefined,
      upiId: m.upi_id || undefined,
    })),
    memberEmails: members
      .filter(m => m.email)
      .map(m => m.email),
    expenses: expenses.map(e => ({
      id: e.id,
      payerId: e.payer_id,
      amount: parseFloat(e.amount),
      note: e.note || '',
      createdAt: e.created_at,
      receiptUrl: e.receipt_url || undefined,
      splitType: e.split_type || 'equal',
      type: e.type || 'expense',
      relatedMemberId: e.related_member_id || undefined,
      splits: splitsMap[e.id] || undefined,
    })),
    isSettled: !!group.is_settled,
    type: group.type || 'trip',
    budget: group.budget ? parseFloat(group.budget) : undefined,
  };
}

// ─── GET /api/groups ── List all groups for the authenticated user ───
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;

    let query;
    let params;

    if (userEmail) {
      query = `
        SELECT DISTINCT g.* FROM user_groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.created_by = ? OR gm.email = ?
        ORDER BY g.created_at DESC
      `;
      params = [userId, userEmail];
    } else {
      query = 'SELECT * FROM user_groups WHERE created_by = ? ORDER BY created_at DESC';
      params = [userId];
    }

    const [groups] = await pool.query(query, params);
    const result = await Promise.all(groups.map(g => fetchGroupById(g.id)));

    res.json(result.filter(Boolean));
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Failed to get groups' });
  }
});

// ─── GET /api/groups/:id ── Get a single group ───
router.get('/:id', async (req, res) => {
  try {
    const group = await fetchGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Failed to get group' });
  }
});

// ─── POST /api/groups ── Create a new group ───
router.post('/', async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const userId = req.user.uid;
    const userEmail = req.user.email;
    const userDisplayName = req.user.displayName;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const groupId = uuidv4();
    const memberId = uuidv4();

    await pool.query(
      'INSERT INTO user_groups (id, name, description, type, created_by) VALUES (?, ?, ?, ?, ?)',
      [groupId, name.trim(), description || '', type || 'trip', userId]
    );

    // Add creator as the initial member
    const memberName = userDisplayName || (userEmail ? userEmail.split('@')[0] : 'Me');
    await pool.query(
      'INSERT INTO group_members (id, group_id, name, user_id, email) VALUES (?, ?, ?, ?, ?)',
      [memberId, groupId, memberName, userId, userEmail || null]
    );

    const group = await fetchGroupById(groupId);
    res.json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// ─── DELETE /api/groups/:id ── Delete a group ───
router.delete('/:id', async (req, res) => {
  try {
    // CASCADE will clean up members, expenses, splits, history
    await pool.query('DELETE FROM user_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
});

// ─── PATCH /api/groups/:id ── Update group fields (isSettled, budget) ───
router.patch('/:id', async (req, res) => {
  try {
    const updates = [];
    const values = [];

    if ('isSettled' in req.body) {
      updates.push('is_settled = ?');
      values.push(req.body.isSettled ? 1 : 0);
    }
    if ('budget' in req.body) {
      updates.push('budget = ?');
      values.push(req.body.budget);
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      await pool.query(
        `UPDATE user_groups SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const group = await fetchGroupById(req.params.id);
    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
});

// ─── POST /api/groups/:id/members ── Add a member ───
router.post('/:id/members', async (req, res) => {
  try {
    const { name, email, userId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Member name is required' });
    }

    // Check for duplicate name
    const [existing] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND LOWER(name) = LOWER(?)',
      [req.params.id, name.trim()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A member with this name already exists' });
    }

    const memberId = uuidv4();
    await pool.query(
      'INSERT INTO group_members (id, group_id, name, user_id, email) VALUES (?, ?, ?, ?, ?)',
      [memberId, req.params.id, name.trim(), userId || null, email || null]
    );

    const group = await fetchGroupById(req.params.id);
    res.json(group);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Failed to add member' });
  }
});

// ─── PUT /api/groups/:id/members/:memberId ── Update a member ───
router.put('/:id/members/:memberId', async (req, res) => {
  try {
    const { name, email, upiId } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null); }
    if (upiId !== undefined) { updates.push('upi_id = ?'); values.push(upiId || null); }

    if (updates.length > 0) {
      values.push(req.params.memberId, req.params.id);
      await pool.query(
        `UPDATE group_members SET ${updates.join(', ')} WHERE id = ? AND group_id = ?`,
        values
      );
    }

    const group = await fetchGroupById(req.params.id);
    res.json(group);
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ message: 'Failed to update member' });
  }
});

// ─── DELETE /api/groups/:id/members/:memberId ── Remove a member ───
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const groupId = req.params.id;
    const memberId = req.params.memberId;

    // Remove expense splits referencing this member
    await pool.query(
      'DELETE es FROM expense_splits es INNER JOIN expenses e ON es.expense_id = e.id WHERE e.group_id = ? AND es.member_id = ?',
      [groupId, memberId]
    );

    // Remove expenses paid by this member
    await pool.query(
      'DELETE FROM expenses WHERE group_id = ? AND payer_id = ?',
      [groupId, memberId]
    );

    // Remove the member
    await pool.query(
      'DELETE FROM group_members WHERE id = ? AND group_id = ?',
      [memberId, groupId]
    );

    const group = await fetchGroupById(groupId);
    res.json(group);
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

// ─── POST /api/groups/:id/expenses ── Add an expense or settlement ───
router.post('/:id/expenses', async (req, res) => {
  try {
    const { payerId, amount, note, receiptUrl, splitType, splits, type, relatedMemberId } = req.body;

    if (!payerId || !amount) {
      return res.status(400).json({ message: 'Payer and amount are required' });
    }

    const expenseId = uuidv4();
    await pool.query(
      `INSERT INTO expenses (id, group_id, payer_id, amount, note, receipt_url, split_type, type, related_member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenseId,
        req.params.id,
        payerId,
        amount,
        note || '',
        receiptUrl || null,
        splitType || 'equal',
        type || 'expense',
        relatedMemberId || null,
      ]
    );

    // Save splits for unequal split
    if (splitType === 'unequal' && splits && Object.keys(splits).length > 0) {
      const splitValues = Object.entries(splits).map(
        ([memberId, splitAmount]) => [uuidv4(), expenseId, memberId, splitAmount]
      );
      await pool.query(
        'INSERT INTO expense_splits (id, expense_id, member_id, amount) VALUES ?',
        [splitValues]
      );
    }

    const group = await fetchGroupById(req.params.id);
    res.json(group);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ message: 'Failed to add expense' });
  }
});

// ─── PUT /api/groups/:id/expenses/:expenseId ── Edit an expense ───
router.put('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const { payerId, amount, note, receiptUrl, splitType, splits } = req.body;

    await pool.query(
      `UPDATE expenses SET payer_id = ?, amount = ?, note = ?, receipt_url = ?, split_type = ?
       WHERE id = ? AND group_id = ?`,
      [
        payerId,
        amount,
        note || '',
        receiptUrl || null,
        splitType || 'equal',
        req.params.expenseId,
        req.params.id,
      ]
    );

    // Re-create splits
    await pool.query('DELETE FROM expense_splits WHERE expense_id = ?', [req.params.expenseId]);
    if (splitType === 'unequal' && splits && Object.keys(splits).length > 0) {
      const splitValues = Object.entries(splits).map(
        ([memberId, splitAmount]) => [uuidv4(), req.params.expenseId, memberId, splitAmount]
      );
      await pool.query(
        'INSERT INTO expense_splits (id, expense_id, member_id, amount) VALUES ?',
        [splitValues]
      );
    }

    const group = await fetchGroupById(req.params.id);
    res.json(group);
  } catch (error) {
    console.error('Edit expense error:', error);
    res.status(500).json({ message: 'Failed to edit expense' });
  }
});

// ─── DELETE /api/groups/:id/expenses/:expenseId ── Remove an expense ───
router.delete('/:id/expenses/:expenseId', async (req, res) => {
  try {
    // expense_splits will cascade-delete
    await pool.query(
      'DELETE FROM expenses WHERE id = ? AND group_id = ?',
      [req.params.expenseId, req.params.id]
    );

    const group = await fetchGroupById(req.params.id);
    res.json(group);
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Failed to delete expense' });
  }
});

// ─── POST /api/groups/:id/reset-month ── Archive & clear expenses ───
router.post('/:id/reset-month', async (req, res) => {
  try {
    const groupId = req.params.id;

    // Get current expenses for archiving
    const [expenses] = await pool.query(
      'SELECT * FROM expenses WHERE group_id = ?',
      [groupId]
    );
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Archive expenses to history
    const historyId = uuidv4();
    await pool.query(
      'INSERT INTO group_history (id, group_id, month_key, expenses_json, total) VALUES (?, ?, ?, ?, ?)',
      [historyId, groupId, monthKey, JSON.stringify(expenses), total]
    );

    // Clear current expenses (cascade deletes expense_splits)
    await pool.query('DELETE FROM expenses WHERE group_id = ?', [groupId]);

    const group = await fetchGroupById(groupId);
    res.json(group);
  } catch (error) {
    console.error('Reset month error:', error);
    res.status(500).json({ message: 'Failed to reset month' });
  }
});

export default router;
