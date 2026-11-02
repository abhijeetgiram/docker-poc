# 1. Start from a ready-made base; a small Linux with Python 3.12 already installed.
FROM python:3.12-slim

# 2. Work inside /app in the container.
WORKDIR /app

# 3. Install libraries first, so Docker can resuse this step when only code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy the app code.
COPY app.py .

# 5. Note for readers: the app listens on port 5000.
EXPOSE 5000

# 6. The command that runs when the container starts.
CMD ["python", "app.py"]