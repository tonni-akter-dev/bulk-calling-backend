-- Bulk Calling System - MySQL Schema

CREATE DATABASE IF NOT EXISTS bulk_calling_system CHARACTER SET utf8mb4;
USE bulk_calling_system;

-- Companies (tenants)
CREATE TABLE companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  wallet_balance_bdt DECIMAL(10,2) NOT NULL DEFAULT 0.00,   -- prepaid call credit
  rate_per_minute_bdt DECIMAL(10,4) NOT NULL DEFAULT 2.5000, -- what you charge the company per minute of calling
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users belonging to a company
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user','agent') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Subscription plans you offer
CREATE TABLE plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price_bdt DECIMAL(10,2) NOT NULL,
  monthly_call_limit INT NOT NULL,
  max_concurrent_calls INT NOT NULL DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE
);

-- A company's subscription (one active row per company at a time)
CREATE TABLE subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  plan_id INT NOT NULL,
  status ENUM('pending','active','expired','cancelled') DEFAULT 'pending',
  calls_used_this_period INT DEFAULT 0,
  current_period_start DATETIME,
  current_period_end DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- bKash payment attempts/records tied to a subscription renewal
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  subscription_id INT NOT NULL,
  bkash_payment_id VARCHAR(100),
  bkash_trx_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('initiated','completed','failed','cancelled') DEFAULT 'initiated',
  raw_response JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Uploaded voicemail/audio files
CREATE TABLE audio_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  public_url VARCHAR(500) NOT NULL,
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Campaigns
CREATE TABLE campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  created_by INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  audio_file_id INT,
  status ENUM('draft','queued','running','paused','completed','failed') DEFAULT 'draft',
  pause_reason ENUM('insufficient_balance','manual','subscription_expired') NULL,
  caller_id VARCHAR(32),
  total_numbers INT DEFAULT 0,
  calls_completed INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  finished_at DATETIME,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (audio_file_id) REFERENCES audio_files(id)
);

-- Numbers within a campaign + per-number call outcome
CREATE TABLE campaign_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  status ENUM('pending','calling','answered','voicemail','no_answer','failed','opted_out','skipped_dnc') DEFAULT 'pending',
  twilio_call_sid VARCHAR(100),
  attempts INT DEFAULT 0,
  call_duration_seconds INT,
  cost_bdt DECIMAL(10,2) DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  INDEX idx_campaign_status (campaign_id, status)
);

-- bKash payments used to top up wallet_balance_bdt (separate from subscription payments)
CREATE TABLE wallet_topups (
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

-- Full ledger of every balance change (recharge credits + per-call debits) for transparency
CREATE TABLE wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  type ENUM('topup','call_charge','refund','adjustment') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,        -- positive = credited, negative = debited
  balance_after DECIMAL(10,2) NOT NULL,
  reference_type VARCHAR(50),           -- 'wallet_topup' | 'campaign_number'
  reference_id INT,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_company_created (company_id, created_at)
);

-- Company-level Do-Not-Call / opt-out list (numbers that pressed opt-out or asked to be removed)
CREATE TABLE do_not_call (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_company_number (company_id, phone_number)
);

INSERT INTO plans (name, price_bdt, monthly_call_limit, max_concurrent_calls) VALUES
('Starter', 2000.00, 1000, 3),
('Growth', 6000.00, 5000, 8),
('Business', 15000.00, 20000, 15);
