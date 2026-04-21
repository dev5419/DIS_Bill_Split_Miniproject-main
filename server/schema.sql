-- SplitEase MySQL/TiDB Schema
-- Run this script to create the database and tables

CREATE DATABASE IF NOT EXISTS splitease;
USE splitease;

-- Users table (no dependencies)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  display_name VARCHAR(255),
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups table (depends on: users)
CREATE TABLE IF NOT EXISTS user_groups (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('trip', 'household') DEFAULT 'trip',
  is_settled BOOLEAN DEFAULT FALSE,
  budget DECIMAL(12, 2) DEFAULT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Group members table (depends on: user_groups)
CREATE TABLE IF NOT EXISTS group_members (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0,
  user_id VARCHAR(36) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  upi_id VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE
);

-- Expenses table (depends on: user_groups)
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL,
  payer_id VARCHAR(36) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT,
  receipt_url TEXT,
  split_type ENUM('equal', 'unequal') DEFAULT 'equal',
  type ENUM('expense', 'settlement') DEFAULT 'expense',
  related_member_id VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE
);

-- Expense splits (depends on: expenses)
CREATE TABLE IF NOT EXISTS expense_splits (
  id VARCHAR(36) PRIMARY KEY,
  expense_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

-- Group history (depends on: user_groups)
CREATE TABLE IF NOT EXISTS group_history (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL,
  month_key VARCHAR(7) NOT NULL,
  expenses_json JSON,
  total DECIMAL(12, 2) DEFAULT 0,
  settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_user_groups_created_by ON user_groups(created_by);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_email ON group_members(email);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_expenses_group_id ON expenses(group_id);
CREATE INDEX idx_expenses_payer_id ON expenses(payer_id);
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_group_history_group_id ON group_history(group_id);
