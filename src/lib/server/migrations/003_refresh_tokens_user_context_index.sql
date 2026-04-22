CREATE INDEX idx_refresh_tokens_user_context
ON refresh_tokens(user_id, context_binding);
