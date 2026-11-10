# The AE Code server: the Linux x64 archive of a release (ae-code-linux-x64.tar.gz), which
# carries the `ae-code` server binary, the web client and its own libatomic. The build context
# holds only that archive and entrypoint.sh; ae-release.yml builds and pushes this image.
# A base image, meant to be extended: besides git and ssh it carries the source-control CLIs
# (gh, glab, fj, gt). Agent CLIs and toolchains are not included; add them in a derived image.

# The source-control CLIs are single binaries, fetched here so curl stays out of the final image.
# Bump a version with its ARG; gh, glab and gt are checked against the checksums their releases publish.
FROM ubuntu:24.04 AS cli-tools
ARG GH_VERSION=2.103.3
ARG GLAB_VERSION=1.130.0
ARG FJ_VERSION=0.7.0
ARG GT_VERSION=1.2.0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils
WORKDIR /dl
RUN set -eu; \
    get() { curl -fsSL --retry 3 -O "$1"; }; \
    gh="gh_${GH_VERSION}_linux_amd64.tar.gz"; \
    get "https://github.com/cli/cli/releases/download/v${GH_VERSION}/$gh"; \
    get "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt"; \
    grep " $gh\$" "gh_${GH_VERSION}_checksums.txt" | sha256sum -c -; \
    glab="glab_${GLAB_VERSION}_linux_amd64.tar.gz"; \
    get "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/$glab"; \
    get "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/checksums.txt"; \
    grep " $glab\$" checksums.txt | sha256sum -c -; \
    get "https://codeberg.org/forgejo-contrib/forgejo-cli/releases/download/v${FJ_VERSION}/forgejo-cli-x86_64-linux.tar.gz"; \
    gt="gitea-cli-${GT_VERSION}-linux-amd64.xz"; \
    get "https://gitea.com/gitea/cli/releases/download/v${GT_VERSION}/$gt"; \
    get "https://gitea.com/gitea/cli/releases/download/v${GT_VERSION}/$gt.sha256"; \
    sha256sum -c "$gt.sha256"; \
    mkdir /out; \
    tar -xzf "$gh" --strip-components=2 -C /out "gh_${GH_VERSION}_linux_amd64/bin/gh"; \
    tar -xzf "$glab" -C /out --strip-components=1 bin/glab; \
    tar -xzf forgejo-cli-x86_64-linux.tar.gz -C /out fj; \
    xz -dc "$gt" > /out/gt; \
    chmod 755 /out/*

FROM ubuntu:24.04

# The base image's `ubuntu` user has uid 1000.
RUN userdel -r ubuntu \
 && groupadd -g 1000 ae && useradd -u 1000 -g ae -m -s /bin/bash ae \
 && install -d -o ae -g ae /home/ae/.ae \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git openssh-client libsecret-1-0 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=cli-tools /out/ /usr/local/bin/
COPY ae-code-linux-x64.tar.gz entrypoint.sh /tmp/
RUN mkdir /opt/ae-code && tar -xzf /tmp/ae-code-linux-x64.tar.gz -C /opt/ae-code --strip-components=1 \
 && /opt/ae-code/ae-code --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^ ]*' | tail -n 1 > /opt/ae-code/VERSION \
 && install -m 755 /tmp/entrypoint.sh /usr/local/bin/ae-code-entrypoint \
 && rm /tmp/ae-code-linux-x64.tar.gz /tmp/entrypoint.sh

ENV PATH=/opt/ae-code:$PATH
USER ae
WORKDIR /home/ae
# The server's state (database, settings, secrets) lives here.
VOLUME /home/ae/.ae
EXPOSE 3773
# Off by default. T3CODE_SELF_UPDATE=true lets Settings -> About install newer releases from
# GitHub in place: the entrypoint then restarts the server from <state>/updates (entrypoint.sh).
ENTRYPOINT ["ae-code-entrypoint"]
CMD ["ae-code", "serve", "--host", "0.0.0.0", "--port", "3773", "--no-browser"]
