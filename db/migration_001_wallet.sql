-- Run this if you already created the database from an earlier version of schema.sql
USE bulk_calling_system;

ALTER TABLE companies
  ADD COLUMN wallet_balance_bdt DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN rate_per_minute_bdt DECIMAL(10,4) NOT NULL DEFAULT 2.5000;

ALTER TABLE campaigns
  ADD COLUMN pause_reason ENUM('insufficient_balance','manual','subscription_expired') NULL AFTER status;

ALTER TABLE campaign_numbers
  ADD COLUMN cost_bdt DECIMAL(10,2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS wallet_topups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  bkash_payment_id VARCHAR(100),
  bkash_trx_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('initiated','completed','failed','cancelled') DEFAULT 'initiated',
  raw_response JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  type ENUM('topup','call_charge','refund','adjustment') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_company_created (company_id, created_at)
);
