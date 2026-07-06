FROM node:22-alpine
WORKDIR /app
COPY server ./server
COPY web ./web
ENV PORT=4321 \
    CLAUDE_DIR=/data/claude/projects \
    KIRO_DIR=/data/kiro/sessions/cli \
    GEMINI_DIR=/data/gemini/tmp \
    CODEX_DIR=/data/codex/sessions
EXPOSE 4321
USER node
CMD ["node", "server/index.js"]
