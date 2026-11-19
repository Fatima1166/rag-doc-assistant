"""Point the app at a throwaway data dir so tests never touch real data.
Must run before app.main is imported, which conftest guarantees."""
import os
import shutil
import tempfile

TEST_DATA = tempfile.mkdtemp(prefix="ragdocs-test-")
os.environ["RAGDATA_DIR"] = TEST_DATA
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
# Pin limits so a developer's backend/.env (which may disable them) can't
# change test behaviour.
os.environ["RATE_LIMIT_AUTH"] = "10"
os.environ["RATE_LIMIT_CHAT"] = "30"
os.environ["SESSION_DAYS"] = "30"
os.environ["AUTH_REQUIRED"] = "true"

import atexit
atexit.register(shutil.rmtree, TEST_DATA, ignore_errors=True)
