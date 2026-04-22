CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  context_binding VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
