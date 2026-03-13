DROP TABLE IF EXISTS related_tools;
DROP TABLE IF EXISTS tool_categories;
DROP TABLE IF EXISTS tools;
DROP TABLE IF EXISTS categories;

CREATE TABLE tools (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,           -- SEO slug, e.g. 'chatgpt'
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,                 -- original CSV description
  url           TEXT NOT NULL,
  image_url     TEXT,
  pricing_raw   TEXT,                          -- raw value from CSV
  pricing_slug  TEXT,                          -- 'free' | 'freemium' | 'paid'
  rating        REAL,                          -- parsed from '4.5/5 (6 votes)'
  votes         INTEGER,
  -- AI-generated fields (populated by ingestion script)
  ai_title      TEXT,                          -- unique <title> tag
  ai_meta       TEXT,                          -- unique meta description
  ai_intro      TEXT,                          -- 150-word unique intro
  ai_use_cases  TEXT,                          -- JSON array of use cases
  -- Embedding stored as JSON float array
  embedding     TEXT,                          -- JSON array [0.001, ...]
  created_at    INTEGER DEFAULT (unixepoch()),
  updated_at    INTEGER DEFAULT (unixepoch())
);

CREATE TABLE categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,          -- 'image-generation'
  name          TEXT NOT NULL,                 -- 'Image Generation'
  ai_description TEXT,                         -- unique 200-word category desc
  ai_meta       TEXT,
  tool_count    INTEGER DEFAULT 0,
  parent_id     INTEGER REFERENCES categories(id)
);

CREATE TABLE tool_categories (
  tool_id       INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  category_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (tool_id, category_id)
);

CREATE TABLE related_tools (
  tool_id       INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  related_id    INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  similarity    REAL NOT NULL,                 -- cosine similarity 0..1
  PRIMARY KEY (tool_id, related_id)
);

CREATE INDEX idx_tools_pricing  ON tools(pricing_slug);
CREATE INDEX idx_tools_rating   ON tools(rating DESC);
CREATE INDEX idx_tc_category    ON tool_categories(category_id);
CREATE INDEX idx_tc_tool        ON tool_categories(tool_id);
