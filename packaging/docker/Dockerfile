# The AE Code server: the Linux x64 archive of a release (ae-code-linux-x64.tar.gz), which
# carries the `ae-code` server binary, the web client and its own libatomic. The build context
# holds only that archive; ae-release.yml builds and pushes this image.
# Agent CLIs are not included: install the ones you use in a derived image.
FROM ubuntu:24.04

# The base image's `ubuntu` user has uid 1000.
RUN userdel -r ubuntu \
 && groupadd -g 1000 ae && useradd -u 1000 -g ae -m -s /bin/bash ae \
 && install -d -o ae -g ae /home/ae/.ae \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git openssh-client libsecret-1-0 \
 && rm -rf /var/lib/apt/lists/*

COPY ae-code-linux-x64.tar.gz /tmp/
RUN mkdir /opt/ae-code && tar -xzf /tmp/ae-code-linux-x64.tar.gz -C /opt/ae-code --strip-components=1 && rm /tmp/ae-code-linux-x64.tar.gz

ENV PATH=/opt/ae-code:$PATH
USER ae
WORKDIR /home/ae
# The server's state (database, settings, secrets) lives here.
VOLUME /home/ae/.ae
EXPOSE 3773
CMD ["ae-code", "serve", "--host", "0.0.0.0", "--port", "3773", "--no-browser"]
