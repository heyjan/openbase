FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Fail closed if the moving image has not yet received the Python mitigation.
RUN python -c "import sys; assert sys.version_info >= (3, 12, 16), 'Python 3.12.16+ required for the eMudhra incident mitigation'" \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt constraints.txt ./
# Bootstrap from the advisory's hash-verified wheel before using pip's CA bundle.
RUN python -m pip install --no-cache-dir --no-deps \
      "pip @ https://files.pythonhosted.org/packages/3f/06/3e4420302363fbb71be3c7f35ce042f54bfca330e3e66b3a2e3c4cca579f/pip-26.2.2-py3-none-any.whl#sha256=fd7f4dfa8190e014013b9f08f3e973f4e4c26ffd179a204895533a7254813a70" \
    && python -m pip install --no-cache-dir --upgrade "pip>=26.2.2" \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && python -m pip check

COPY security_check.py ./
RUN python security_check.py

COPY openbase_agent ./openbase_agent

EXPOSE 8000
CMD ["uvicorn", "openbase_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
