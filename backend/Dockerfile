FROM rust:1.63 as builder
WORKDIR /usr/src/docversions
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update & apt-get install -y extra-runtime-dependencies & rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/docversions
COPY --from=builder /usr/src/docversions/target/release/docversions .
COPY --from=builder /usr/src/docversions/configuration.yaml .
ENV PORT 8080
EXPOSE 8000
ENTRYPOINT ["./docversions"]
