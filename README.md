# Document Versions

![Document](https://github.com/sitMCella/doc-versions/wiki/images/Document.png)

## Table of contents

* [Introduction](#introduction)
* [Development](#development)
    * [Setup Development](#setup-development)
    * [Configuration Development](#configuration-development)
    * [Build Project Development](#build-project-development)
* [Production](#production)
  * [Setup Production](#setup-production)
  * [Configuration Production](#configuration-production)
  * [Build Project Production](#build-project-production)

## Introduction

Document Versions is a web application that manages the versions of text documents via Git.
In the current version of the application, the files are stored in the local environment.

## Development

Document Versions is a web application built using the Rust language on the backend, and React JS framework on the frontend.
Document Versions stores and versions the files using a Git client via the libgit2 library for Rust.

### Setup Development

Install Node.js. Recommended version >= 19.5.0

Install Rust and Cargo. Recommended version:
- Rustc and Cargo >= 1.63.0

### Configuration Development

Configure the root directory for the workspaces in 'backend/configuration.yaml'.

Configure the root directory for the backed tests in 'backend/configuration_test.yaml'.

### Build Project Development

#### Run Unit and Integration Tests (Backend)

``` sh
cd ./backend
cargo test  -- --nocapture
```

#### Rust Code Coverage

```sh
cd ./backend
cargo tarpaulin --ignore-tests
```

#### Rust Linter

```sh
cd ./backend
cargo clippy -- -D warnings
```

#### Format Code (Backend)

```sh
cd ./backend
cargo fmt
```

#### Build (Backend)

``` sh
cd ./backend
cargo build
```

#### Build (Frontend)

``` sh
cd ./frontend
npm run build
```

#### Eslint Check:

```sh
cd ./frontend
eslint --ext .jsx,.js src/
```

#### Eslint Format:

```sh
cd ./frontend
eslint --fix --ext .jsx,.js src/
```

#### Run application

#### Run Application Backend

``` sh
cd ./backend
cargo run
```

#### Run Application Frontend

``` sh
cd ./frontend
npm run start
```

#### Run Application Frontend (Electron)

``` sh
cd ./frontend
npm run dev
```

#### Access the application

```sh
http://localhost:3000
```

## Production

### Setup Production

Install Node.js. Recommended version >= 19.5.0

Install Docker and Docker Compose.

### Configuration Production

Configure the root directory for the workspaces in 'backend/configuration.yaml' with the following content:

``` yaml
application_port: 8000
workspaces_path: "/app/git-workspace"
```

### Build Project Production

#### Build (Backend)

``` sh
cd ./backend
cargo build --release
```

#### Build (Frontend)

``` sh
cd ./frontend
npm run build
```

#### Build Docker Images

``` sh
docker-compose build
```

#### Run application

```sh
docker-compose up
```

#### Access the application

```sh
http://localhost:80
```
