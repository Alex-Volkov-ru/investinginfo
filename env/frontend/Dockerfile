# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY app/frontend-react/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY app/frontend-react/ ./

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config (local.conf для работы внутри контейнера)
COPY env/frontend/local.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

