FROM rust:1.63
WORKDIR /usr/src/docversions
COPY . .
RUN cargo build --release
ENV PORT 8080
EXPOSE 8000
ENTRYPOINT ["./target/release/docversions"]
