FROM postgres:13.2-alpine

# Fetch message-db
ADD https://github.com/message-db/message-db/archive/refs/tags/v1.2.6.tar.gz message-db.tar.gz
RUN mkdir -p /usr/src/message-db
RUN tar -xvf message-db.tar.gz -C /usr/src/message-db --strip-components=1

# Create the initialization script
RUN echo "#!/bin/bash" > /docker-entrypoint-initdb.d/init-message-db.sh
RUN echo "cd /usr/src/message-db/database/; ./install.sh" >> /docker-entrypoint-initdb.d/init-message-db.sh
