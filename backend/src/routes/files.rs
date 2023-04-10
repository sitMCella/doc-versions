use actix_multipart::form::tempfile::TempFile;
use actix_multipart::form::text::Text;
use actix_multipart::form::MultipartForm;
use actix_web::{web, HttpResponse};
use git2::{Commit, IndexAddOption, ObjectType, Repository, Signature, Status, StatusOptions};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct FileStatus {
    name: String,
    status: String,
}

#[derive(MultipartForm)]
pub struct Upload {
    pub file: TempFile,
    pub commit_message: Text<String>,
}

#[derive(MultipartForm)]
pub struct Delete {
    pub commit_message: Text<String>,
}

// curl -X GET -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}/files
pub async fn retrieve_files_status(
    path_param: web::Path<(String, String)>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, &workspace_name);
    let branch_name = &path_param.1;
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    if let Err(e) = set_branch(&repository, branch_name) {
        eprintln!(
            "Error while setting the current branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    match get_files_status_from_last_commit(&repository) {
        Ok(files_status) => HttpResponse::Ok().json(files_status),
        Err(e) => {
            eprintln!(
                "Error while retrieving the files status from the branch {}: {:#?}",
                branch_name, e
            );
            return HttpResponse::InternalServerError().finish();
        }
    }
}

// curl -X GET -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}/files/{file_name}
pub async fn retrieve_file_content(
    path_param: web::Path<(String, String, String)>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, &workspace_name);
    let branch_name = &path_param.1;
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    if let Err(e) = set_branch(&repository, branch_name) {
        eprintln!(
            "Error while setting the current branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    let file_name = &path_param.2;
    match get_file_content_from_last_commit(&repository, &file_name) {
        Ok(file_content) => HttpResponse::Ok().body(file_content),
        Err(e) => {
            eprintln!(
                "Error while retrieving the file content from the branch {}: {:#?}",
                branch_name, e
            );
            return HttpResponse::InternalServerError().finish();
        }
    }
}

// curl -X POST -H 'Content-Type: multipart/form-data' -F file=@/path/to/file -Fcommit_message='commit message' -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}/files/{file_name}
pub async fn create_file(
    path_param: web::Path<(String, String, String)>,
    form: MultipartForm<Upload>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, &workspace_name);
    let branch_name = &path_param.1;
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    if let Err(e) = set_branch(&repository, branch_name) {
        eprintln!(
            "Error while setting the current branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    let file_name = &path_param.2;
    match get_files_status_from_last_commit(&repository) {
        Ok(files_status) => {
            let files_name: Vec<String> = files_status
                .into_iter()
                .map(|file_status| file_status.name)
                .collect();
            if files_name.contains(&file_name) {
                return HttpResponse::Conflict().finish();
            }
        }
        Err(e) => {
            eprintln!(
                "Error while retrieving the files status from the branch {}: {:#?}",
                branch_name, e
            );
            return HttpResponse::InternalServerError().finish();
        }
    }
    let source_filepath = &form.file.file.as_ref();
    let destination_filepath = Path::new(&workspace_path).join(&file_name);
    if let Err(e) = fs::copy(&source_filepath, &destination_filepath) {
        eprintln!("Error while creating the file: {:#?}", e);
        return HttpResponse::InternalServerError().finish();
    }
    let commit_message = form.commit_message.as_str();
    if let Err(e) = create_commit(&repository, commit_message) {
        eprintln!(
            "Error while creating a commit in the branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    };
    return HttpResponse::Created().finish();
}

// curl -X PUT -H 'Content-Type: multipart/form-data' -F file=@/path/to/file -Fcommit_message='commit message' -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}/files/{file_name}
pub async fn update_file(
    path_param: web::Path<(String, String, String)>,
    form: MultipartForm<Upload>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, &workspace_name);
    let branch_name = &path_param.1;
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    if let Err(e) = set_branch(&repository, branch_name) {
        eprintln!(
            "Error while setting the current branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    let file_name = &path_param.2;
    match get_files_status_from_last_commit(&repository) {
        Ok(files_status) => {
            let files_name: Vec<String> = files_status
                .into_iter()
                .map(|file_status| file_status.name)
                .collect();
            if !files_name.contains(&file_name) {
                return HttpResponse::NotFound().finish();
            }
        }
        Err(e) => {
            eprintln!(
                "Error while retrieving the files status from the branch {}: {:#?}",
                branch_name, e
            );
            return HttpResponse::InternalServerError().finish();
        }
    }
    let source_filepath = &form.file.file.as_ref();
    let destination_filepath = Path::new(&workspace_path).join(&file_name);
    if let Err(e) = fs::copy(&source_filepath, &destination_filepath) {
        eprintln!("Error while updating the file: {:#?}", e);
        return HttpResponse::InternalServerError().finish();
    }
    let commit_message = form.commit_message.as_str();
    if let Err(e) = create_commit(&repository, commit_message) {
        eprintln!(
            "Error while creating a commit in the branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    };
    return HttpResponse::Ok().finish();
}

// curl -X DELETE -H 'Content-Type: multipart/form-data' -Fcommit_message='commit message' -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}/files/{file_name}
pub async fn delete_file(
    path_param: web::Path<(String, String, String)>,
    form: MultipartForm<Delete>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, &workspace_name);
    let branch_name = &path_param.1;
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    if let Err(e) = set_branch(&repository, branch_name) {
        eprintln!(
            "Error while setting the current branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    let file_name = &path_param.2;
    match get_files_status_from_last_commit(&repository) {
        Ok(files_status) => {
            let files_name: Vec<String> = files_status
                .into_iter()
                .map(|file_status| file_status.name)
                .collect();
            if !files_name.contains(&file_name) {
                return HttpResponse::NotFound().finish();
            }
        }
        Err(e) => {
            eprintln!(
                "Error while retrieving the files status from the branch {}: {:#?}",
                branch_name, e
            );
            return HttpResponse::InternalServerError().finish();
        }
    }
    let destination_filepath = Path::new(&workspace_path).join(&file_name);
    println!("Remove file: {:#?}", &destination_filepath);
    if let Err(e) = fs::remove_file(&destination_filepath) {
        eprintln!("Error while deleting the file: {:#?}", e);
        return HttpResponse::InternalServerError().finish();
    }
    let commit_message = form.commit_message.as_str();
    if let Err(e) = create_commit(&repository, commit_message) {
        eprintln!(
            "Error while creating a commit in the branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    };
    return HttpResponse::Ok().finish();
}

fn get_workspace_path(workspace_directory: PathBuf, workspace_name: &String) -> String {
    let mut workspace = workspace_directory.clone();
    workspace.push(workspace_name);
    workspace.to_str().unwrap().to_string()
}

fn get_repository(workspace_path: &str) -> Option<Repository> {
    let repository = match Repository::open(&workspace_path) {
        Ok(r) => r,
        Err(e) => {
            println!("{}", &e.message());
            return None;
        }
    };
    Some(repository)
}

fn set_branch(repository: &Repository, branch_name: &String) -> Result<(), git2::Error> {
    let (object, reference) = repository.revparse_ext(branch_name)?;
    match reference {
        Some(gref) => repository.set_head(gref.name().unwrap())?,
        None => repository.set_head_detached(object.id())?,
    };
    repository.checkout_head(Some(
        git2::build::CheckoutBuilder::default()
        .remove_untracked(true).remove_ignored(true).force(),
    ))?;
    Ok(())
}

fn get_files_status_from_last_commit(repo: &Repository) -> Result<Vec<FileStatus>, git2::Error> {
    let mut vec: Vec<FileStatus> = Vec::new();
    let mut status_options = StatusOptions::new();
    status_options
        .include_ignored(false)
        .include_unmodified(true)
        .include_untracked(true);
    let statuses = repo.statuses(Some(&mut status_options))?;
    statuses.iter().for_each(|status_entry| {
        let status_name = match status_entry.status() {
            Status::CURRENT => "current".to_string(),
            Status::WT_NEW => "new".to_string(),
            Status::WT_DELETED => "deleted".to_string(),
            _ => "other".to_string(),
        };
        let file_status = FileStatus {
            name: status_entry.path().unwrap().to_string(),
            status: status_name,
        };
        vec.push(file_status);
    });
    Ok(vec)
}

fn find_last_commit(repo: &Repository) -> Result<Commit, git2::Error> {
    let obj = repo.head()?.resolve()?.peel(ObjectType::Commit)?;
    obj.into_commit()
        .map_err(|_| git2::Error::from_str("Couldn't find commit"))
}

fn get_file_content_from_last_commit(
    repo: &Repository,
    file_name: &String,
) -> Result<Vec<u8>, git2::Error> {
    let last_commit = find_last_commit(&repo)?;
    let tree = last_commit.tree()?;
    match tree.get_name(&file_name) {
        Some(file) => {
            if file.kind().unwrap() == ObjectType::Blob {
                let obj = file.to_object(repo)?;
                let blob = obj.as_blob().unwrap();
                return Ok(blob.content().to_vec());
            }
        }
        None => {
            return Err(git2::Error::from_str(
                format!("Error while retrieving the file with name {}", &file_name).as_str(),
            ))
        }
    }
    Ok(vec![0])
}

fn create_commit(repository: &Repository, commit_message: &str) -> Result<git2::Oid, git2::Error> {
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
        commit_message,
        &tree,
        &[&master_branch_first_commit.unwrap()],
    )
}
