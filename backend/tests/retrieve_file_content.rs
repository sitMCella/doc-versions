use docversions::configuration::{get_configuration, Settings};
use docversions::startup::run;
use git2::{Commit, IndexAddOption, ObjectType, Repository, Signature};
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use uuid::Uuid;

#[tokio::test]
async fn retrieve_files_content_returns_500_for_initialized_repository() {
    let workspace_name = get_workspace_name();
    let configuration_file = configure_test(&workspace_name).unwrap_or_else(|error| {
        panic!("Error while configuring the test: {:?}.", error);
    });
    let configuration =
        get_configuration(&configuration_file).expect("Failed to read configuration.");
    let workspace = get_workspace(&configuration, &workspace_name);
    let address = spawn_app(&configuration, &workspace);
    let create_repository = create_git_repository(&workspace);
    assert!(create_repository.is_ok());
    let client = reqwest::Client::new();
    let branch_name = "master".to_string();
    let file_name = "README.md".to_string();

    let response = client
        .get(&format!(
            "{}/api/workspaces/{}/branches/{}/files/{}",
            &address, &workspace_name, &branch_name, &file_name
        ))
        .send()
        .await
        .expect("Failed to execute request.");

    cleanup(&configuration_file, &configuration, &workspace_name);
    assert!(response.status().is_server_error());
}

#[tokio::test]
async fn retrieve_file_content_on_master_branch_returns_200_for_repository_with_master_branch_and_readme_file(
) {
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
    let branch_result = create_master_branch(&repository);
    assert!(branch_result.is_ok());
    let copy_file_result = copy_file(&configuration, &workspace_name);
    assert!(copy_file_result.is_ok());
    let second_commit_result = create_second_commit(&repository);
    assert!(second_commit_result.is_ok());
    let master_branch_last_commit = find_last_commit(&repository);
    assert!(master_branch_last_commit.is_ok());
    let client = reqwest::Client::new();
    let branch_name = "master".to_string();
    let file_name = "README.md".to_string();

    let response = client
        .get(&format!(
            "{}/api/workspaces/{}/branches/{}/files/{}",
            &address, &workspace_name, &branch_name, &file_name
        ))
        .send()
        .await
        .expect("Failed to execute request.");

    cleanup(&configuration_file, &configuration, &workspace_name);
    assert!(response.status().is_success());
}

#[tokio::test]
async fn retrieve_file_content_on_master_branch_returns_file_content_for_repository_with_master_branch_and_readme_file(
) {
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
    let branch_result = create_master_branch(&repository);
    assert!(branch_result.is_ok());
    let copy_file_result = copy_file(&configuration, &workspace_name);
    assert!(copy_file_result.is_ok());
    let second_commit_result = create_second_commit(&repository);
    assert!(second_commit_result.is_ok());
    let master_branch_last_commit = find_last_commit(&repository);
    assert!(master_branch_last_commit.is_ok());
    let client = reqwest::Client::new();
    let branch_name = "master".to_string();
    let file_name = "README.md".to_string();

    let response = client
        .get(&format!(
            "{}/api/workspaces/{}/branches/{}/files/{}",
            &address, &workspace_name, &branch_name, &file_name
        ))
        .send()
        .await
        .expect("Failed to execute request.")
        .text()
        .await
        .expect("failed to get payload");

    cleanup(&configuration_file, &configuration, &workspace_name);
    assert_eq!(
        response,
        "New Workspace!".to_string(),
        "The body content should be the content of the README.me file."
    );
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

fn create_master_branch(repository: &Repository) -> Result<git2::Oid, git2::Error> {
    let first_commit_oid = create_first_commit(&repository)?;
    let (object, reference) = repository.revparse_ext("master")?;
    match reference {
        Some(gref) => repository.set_head(gref.name().unwrap())?,
        None => repository.set_head_detached(object.id())?,
    };
    Ok(first_commit_oid)
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

fn copy_file(configuration: &Settings, workspace_name: &String) -> std::io::Result<u64> {
    let mut file_path = PathBuf::from(&configuration.workspaces_path);
    file_path.push(workspace_name);
    file_path.push("README.md");
    std::fs::copy("worspace_README.md", &file_path)
}

fn create_second_commit(repository: &Repository) -> Result<git2::Oid, git2::Error> {
    let master_branch_first_commit = find_last_commit(&repository);
    assert!(master_branch_first_commit.is_ok());
    let mut index = repository.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let oid = index.write_tree()?;
    let signature = Signature::now("Marco Cella", "marco.cella.tv@gmail.com")?;
    let tree = repository.find_tree(oid)?;
    repository.commit(
        Some("HEAD"),
        &signature,
        &signature,
        "create file",
        &tree,
        &[&master_branch_first_commit.unwrap()],
    )
}

fn find_last_commit(repo: &Repository) -> Result<Commit, git2::Error> {
    let obj = repo.head()?.resolve()?.peel(ObjectType::Commit)?;
    obj.into_commit()
        .map_err(|_| git2::Error::from_str("Couldn't find commit"))
}
