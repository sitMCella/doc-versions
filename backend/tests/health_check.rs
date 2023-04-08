use docversions::configuration::{get_configuration, Settings};
use docversions::startup::run;
use std::fs::{self};
use std::net::TcpListener;
use std::path::PathBuf;
use uuid::Uuid;

#[tokio::test]
async fn health_check_works() {
    let workspace_name = get_workspace_name();
    let configuration_file = configure_test(&workspace_name).unwrap_or_else(|error| {
        panic!("Error while configuring the test: {:?}.", error);
    });
    let configuration =
        get_configuration(&configuration_file).expect("Failed to read configuration.");
    let workspace = get_workspace(&configuration, &workspace_name);
    let address = spawn_app(&configuration, &workspace);
    let client = reqwest::Client::new();

    let response = client
        .get(&format!("{}/health_check", &address))
        .send()
        .await
        .expect("Failed to execute request.");

    cleanup(&configuration_file, &configuration, &workspace_name);
    assert!(response.status().is_success());
    assert_eq!(Some(0), response.content_length());
}

fn get_workspace_name() -> String {
    let uuid = Uuid::new_v4().to_simple_string();
    return uuid;
}

fn configure_test(workspace_name: &String) -> std::io::Result<PathBuf> {
    let mut configuration_file = PathBuf::from("tests_execution");
    configuration_file.push(&workspace_name);
    configuration_file.set_extension("yaml");
    std::fs::copy("configuration_test.yaml", &configuration_file)?;
    Ok(configuration_file)
}

fn cleanup(configuration_file: &PathBuf, configuration: &Settings, workspace_name: &String) {
    let mut workspace = PathBuf::from(&configuration.workspaces_path);
    workspace.push(&workspace_name);
    if workspace.exists() {
        _ = fs::remove_dir_all(workspace.as_path());
    }
    if configuration_file.exists() {
        _ = fs::remove_file(configuration_file.as_path());
    }
}

fn spawn_app(configuration: &Settings, workspace: &PathBuf) -> String {
    if workspace.exists() {
        _ = fs::remove_dir_all(workspace.as_path());
    }
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind random port");
    let port = listener.local_addr().unwrap().port();
    let server = run(listener, &configuration).expect("Failed to bind address");
    let _ = tokio::spawn(server);
    format!("http://127.0.0.1:{}", port)
}

fn get_workspace(configuration: &Settings, workspace_name: &String) -> PathBuf {
    let mut workspace = PathBuf::from(&configuration.workspaces_path);
    workspace.push(&workspace_name);
    workspace
}
