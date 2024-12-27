# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Add non-root user for build
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies with yarn
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Set build-time environment variables
ARG API_URL
ENV VITE_API_URL=${API_URL}
ENV NODE_ENV=production

# Build production bundle
RUN yarn build

# Optimize assets with compression
RUN apk add --no-cache brotli && \
    find dist -type f -regex '.*\.\(js\|css\|html\|svg\|json\)$' -exec gzip -9 -k {} \; && \
    find dist -type f -regex '.*\.\(js\|css\|html\|svg\|json\)$' -exec brotli -Z {} \;

# Stage 2: Production stage
FROM nginx:1.25-alpine

# Add non-root user
RUN adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Install required packages
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chmod -R 544 /usr/share/nginx/html && \
    chmod -R 544 /etc/nginx/security-headers.conf && \
    chmod -R 544 /etc/nginx/nginx.conf

# Create health check endpoint
RUN echo "OK" > /usr/share/nginx/html/health

# Configure custom error pages
COPY error_pages/ /usr/share/nginx/html/error_pages/

# Set resource limits
ENV NGINX_WORKER_PROCESSES="auto" \
    NGINX_WORKER_CONNECTIONS="1024" \
    NGINX_WORKER_RLIMIT_NOFILE="2048"

# Expose port
EXPOSE 80

# Set security headers
RUN echo "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' ${API_URL}\";" > /etc/nginx/security-headers.conf && \
    echo "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;" >> /etc/nginx/security-headers.conf && \
    echo "add_header X-Frame-Options \"DENY\" always;" >> /etc/nginx/security-headers.conf && \
    echo "add_header X-Content-Type-Options \"nosniff\" always;" >> /etc/nginx/security-headers.conf && \
    echo "add_header X-XSS-Protection \"1; mode=block\" always;" >> /etc/nginx/security-headers.conf && \
    echo "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;" >> /etc/nginx/security-headers.conf

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Switch to non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]