# Stage 1: Build the Vite React application
FROM node:20-alpine AS build-stage

WORKDIR /app

# Copy dependency files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build argument for Vite environment variable (default: http://localhost:5000)
ARG VITE_API_SERVERURL=http://localhost:5000
ENV VITE_API_SERVERURL=$VITE_API_SERVERURL

# Build the production bundle
RUN npm run build

# Stage 2: Serve application with Nginx
FROM nginx:alpine AS production-stage

# Copy Nginx SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to Nginx web root directory
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
