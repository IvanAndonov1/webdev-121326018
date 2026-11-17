CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely adapt the older 001 migration, if it is present in an existing database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'full_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users RENAME COLUMN full_name TO name;
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
UPDATE users
SET name = COALESCE(name, (
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'full_name'
), 'StudySync User')
WHERE name IS NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

CREATE TABLE IF NOT EXISTS study_groups (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, name)
);

-- Adapt the older migration's created_by column and the earlier two-table schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_groups' AND column_name = 'created_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_groups' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE study_groups RENAME COLUMN created_by TO owner_id;
  END IF;
END $$;

ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

INSERT INTO courses (code, title)
VALUES ('GENERAL', 'General Study')
ON CONFLICT (code) DO NOTHING;

UPDATE study_groups
SET course_id = (SELECT id FROM courses WHERE code = 'GENERAL')
WHERE course_id IS NULL;

UPDATE study_groups
SET owner_id = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

ALTER TABLE study_groups ALTER COLUMN course_id SET NOT NULL;
ALTER TABLE study_groups ALTER COLUMN owner_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_groups_course_name_unique'
      AND conrelid = 'study_groups'::regclass
  ) THEN
    ALTER TABLE study_groups
      ADD CONSTRAINT study_groups_course_name_unique UNIQUE (course_id, name);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS group_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_study_groups_course ON study_groups(course_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_owner ON study_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
