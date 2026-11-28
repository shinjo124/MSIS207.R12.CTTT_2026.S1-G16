-- Chat between users: one-to-one conversations and one group conversation per trip.
CREATE TABLE conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(10) NOT NULL,
  trip_id BIGINT UNSIGNED NULL,
  direct_key VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NULL,
  UNIQUE KEY uq_conversations_trip (trip_id),
  UNIQUE KEY uq_conversations_direct (direct_key),
  INDEX idx_conversations_last (last_message_at),
  CONSTRAINT fk_conversations_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversation_members (
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  last_read_message_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (conversation_id, user_id),
  INDEX idx_conversation_members_user (user_id),
  CONSTRAINT fk_conversation_members_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_messages_conversation (conversation_id, id),
  CONSTRAINT fk_chat_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_blocks (
  blocker_user_id BIGINT UNSIGNED NOT NULL,
  blocked_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
