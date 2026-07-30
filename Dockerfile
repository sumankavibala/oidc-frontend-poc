# Stage 1: Build the Vite React application
FROM node:20-alpine AS build-stage

WORKDIR /app

# Copy dependency files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Set placeholder during build so Vite bakes it into JS assets
ARG VITE_API_SERVERURL=__VITE_API_SERVERURL_PLACEHOLDER__
ENV VITE_API_SERVERURL=$VITE_API_SERVERURL

# Build the production bundle
RUN npm run build

# Stage 2: Serve application with Nginx
FROM nginx:alpine AS production-stage

# Copy Nginx SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to Nginx web root directory
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy entrypoint script for runtime env replacement
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose HTTP port 80
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
