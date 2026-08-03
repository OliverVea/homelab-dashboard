# Static files on nginx. There is no build step and no framework — if this image
# ever needs a bundler, the brief has been lost.
FROM nginx:1.29-alpine

COPY site/ /usr/share/nginx/html/

# nginx:alpine already ships a config that serves /usr/share/nginx/html on :80
# and returns index.html for /. Nothing to add.
EXPOSE 80
