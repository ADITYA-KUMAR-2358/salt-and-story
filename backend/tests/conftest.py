import os
import tempfile

# Must be set before the app package is imported. Real env vars win over .env,
# so tests never touch a real model, real quota or real data.
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="salt-test-")
os.environ["ELEVENLABS_API_KEY"] = "test-key"
os.environ["LLM_BASE_URL"] = "http://llm.invalid/v1"
os.environ["LLM_API_KEY"] = "test"
os.environ["LLM_MAX_RPM"] = "0"
os.environ["SUBMIT_LIMIT"] = "0"
os.environ["LLM_MAX_PER_DAY"] = "0"
os.environ["USER_DAILY_LIMIT"] = "0"
os.environ["IP_DAILY_LIMIT"] = "0"
os.environ["ACCOUNTS_PER_IP_PER_DAY"] = "0"
