# Document Versions

## Table of contents

* [Introduction](#introduction)
* [Development](#development)
    * [Setup](#setup)
    * [Configuration](#configuration)
    * [Build project](#build-project)

## Introduction

Document Versions is a web application that manages the versions of text documents via Git.

## Development

Document Versions is a web application built using the Rust language on the backend, and React JS framework on the frontend.

### Setup

Install React.js.

Install Rust and Cargo. Recommended version:
- Rustc and Cargo >= 1.63.0

### Configuration

Configure the root directory for the workspaces in 'backend/configuration.yaml'.

Configure the root directory for the backed tests in 'backend/configuration_test.yaml'.

### Build project

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
