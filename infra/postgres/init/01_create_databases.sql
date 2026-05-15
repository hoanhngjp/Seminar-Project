-- PostgreSQL init script: runs once when the container is first created.
-- Creates all per-service databases under the main POSTGRES_USER.

\connect postgres

CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE music_db;
CREATE DATABASE streaming_db;
CREATE DATABASE listening_party_db;
CREATE DATABASE analytics_db;
CREATE DATABASE notification_db;

-- Grant all privileges to the application user
GRANT ALL PRIVILEGES ON DATABASE auth_db TO smartmusic;
GRANT ALL PRIVILEGES ON DATABASE user_db TO smartmusic;
GRANT ALL PRIVILEGES ON DATABASE music_db TO smartmusic;
GRANT ALL PRIVILEGES ON DATABASE streaming_db TO smartmusic;
GRANT ALL PRIVILEGES ON DATABASE listening_party_db TO smartmusic;
GRANT ALL PRIVILEGES ON DATABASE analytics_db TO smartmusic;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO smartmusic;
