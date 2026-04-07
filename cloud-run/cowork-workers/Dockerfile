FROM python:3.12-slim-bookworm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV PATH="/usr/local/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates git ffmpeg build-essential \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /bin/bash cowork
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

RUN UV_SYSTEM_PYTHON=1 uv pip install --system \
  numpy \
  pandas \
  matplotlib \
  pillow \
  requests \
  scipy \
  scikit-learn \
  pypdf \
  openpyxl

COPY src ./src

RUN mkdir -p /tmp/cowork-workers-sessions \
  && chown -R cowork:cowork /app /tmp/cowork-workers-sessions /home/cowork

USER cowork

EXPOSE 8080

CMD ["node", "src/index.js"]
