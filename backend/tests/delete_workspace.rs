use docversions::configuration::{get_configuration, Settings};
use docversions::startup::run;
use git2::{Repository, Signature};
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use uuid::Uuid;

#[tokio::test]
async fn delete_workspace_returns_200_on_existing_workspace() {
    let workspace_name = get_workspace_name();
    let configuration_file = configure_test(&workspace_name).unwrap_or_else(|error| {
        panic!("Error while configuring the test: {:?}.", error);
    });
    let configuration =
        get_configuration(&configuration_file).expect("Failed to read configuration.");
    let workspace = get_workspace(&configuration, &workspace_name);
    let address = spawn_app(&configuration, &workspace);
    let repository = create_git_repository(&workspace).unwrap_or_else(|e| {
        panic!("Error while retrieving the repository: {:?}", e);
    });
    let branch_result = create_master_branch(repository);
    assert!(branch_result.is_ok());
    let client = reqwest::Client::new();

    let response = client
        .delete(&format!("{}/api/workspaces/{}", &address, &workspace_name))
        .send()
        .await
        .expect("Failed to execute request.");

    cleanup(&configuration_file, &configuration, &workspace_name);
    assert!(response.status().is_success());
}

#[tokio::test]
async fn delete_workspace_returns_404_on_non_existing_workspace() {
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
        .delete(&format!("{}/api/workspaces/{}", &address, &workspace_name))
        .send()
        .await
        .expect("Failed to execute request.");

    cleanup(&configuration_file, &configuration, &workspace_name);
    assert!(response.status().is_client_error());
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

fn create_git_repository(workspace: &PathBuf) -> Result<Repository, git2::Error> {
    Repository::init(&workspace)
}

fn create_master_branch(repository: Repository) -> Result<(), git2::Error> {
    create_first_commit(&repository)?;
    let (object, reference) = repository.revparse_ext("master")?;
    match reference {
        Some(gref) => repository.set_head(gref.name().unwrap())?,
        None => repository.set_head_detached(object.id())?,
    };
    Ok(())
}

fn create_first_commit(repository: &Repository) -> Result<git2::Oid, git2::Error> {
    let mut index = repository.index()?;
    let oid = index.write_tree()?;
    let signature = Signature::now("Marco Cella", "marco.cella.tv@gmail.com")?;

    let tree = repository.find_tree(oid)?;

    repository.commit(
        Some("HEAD"),
        &signature,
        &signature,
        "commit message",
        &tree,
        &[],
    )
}
