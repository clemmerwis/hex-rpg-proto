FROM nginx:alpine

# Copy your game files to nginx's default serving directory
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80