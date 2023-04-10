use actix_web::{web, HttpResponse};
use git2::{Branch, BranchType, Commit, ObjectType, Repository};
use std::path::PathBuf;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct GitBranch {
    name: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct GitLog {
    commit_uuid: String,
    message: String,
}

// curl -X GET -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches
pub async fn retrieve_branches(
    workspace_name_param: web::Path<String>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = workspace_name_param.into_inner();
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, &workspace_name);
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    let mut vec: Vec<GitBranch> = Vec::new();
    match repository.branches(Some(BranchType::Local)) {
        Ok(branches) => {
            for b in branches {
                match get_branch_name(b) {
                    Ok(branch_name) => vec.push(branch_name),
                    Err(e) => {
                        println!("{}", &e.message());
                        return HttpResponse::InternalServerError().finish();
                    }
                }
            }
        }
        Err(e) => {
            println!("{}", &e.message());
            return HttpResponse::InternalServerError().finish();
        }
    }
    HttpResponse::Ok().json(vec)
}

// curl -X POST -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}
pub async fn create_branches(
    path_param: web::Path<(String, String)>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, workspace_name);
    let branch_name = &path_param.1;
    let repository = match get_repository(&workspace_path) {
        Some(r) => r,
        None => {
            println!("Error while retrieving the repository");
            return HttpResponse::InternalServerError().finish();
        }
    };
    if let Err(e) = create_branch(repository, &branch_name) {
        eprintln!("Error while creating the branch {}: {:#?}", &branch_name, e);
        return HttpResponse::InternalServerError().finish();
    }
    HttpResponse::Ok().finish()
}

// curl -X PUT -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}
pub async fn set_current_branch(
    path_param: web::Path<(String, String)>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, workspace_name);
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
            "Error while setting the current the branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    HttpResponse::Ok().finish()
}

// curl -X GET -v http://127.0.0.1:8000/workspaces/{workspace_name}/branches/{branch_name}/logs
pub async fn get_branch_logs(
    path_param: web::Path<(String, String)>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = &path_param.0;
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace_path = get_workspace_path(workspace_directory, workspace_name);
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
            "Error while setting the current the branch {}: {:#?}",
            branch_name, e
        );
        return HttpResponse::InternalServerError().finish();
    }
    match get_logs(&repository) {
        Ok(logs) => HttpResponse::Ok().json(logs),
        Err(e) => {
            eprintln!(
                "Error while setting the current the branch {}: {:#?}",
                branch_name, e
            );
            return HttpResponse::InternalServerError().finish();
        }
    }
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

fn get_branch_name(b: Result<(Branch, BranchType), git2::Error>) -> Result<GitBranch, git2::Error> {
    match b {
        Ok((branch, _)) => match branch.name() {
            Ok(name) => {
                let branch = GitBranch {
                    name: String::from(name.unwrap()),
                };
                return Ok(branch);
            }
            Err(e) => {
                eprintln!("Error retrieving the branch name: {e}");
                return Err(e);
            }
        },
        Err(e) => {
            eprintln!("Error retrieving the branch: {e}");
            Err(e)
        }
    }
}

fn create_branch(repository: Repository, branch_name: &String) -> Result<(), git2::Error> {
    let last_commit = find_last_commit(&repository)?;
    repository.branch(branch_name, &last_commit, false)?;
    let (object, reference) = repository.revparse_ext(branch_name)?;
    match reference {
        Some(gref) => repository.set_head(gref.name().unwrap())?,
        None => repository.set_head_detached(object.id())?,
    };
    Ok(())
}

fn find_last_commit(repo: &Repository) -> Result<Commit, git2::Error> {
    let obj = repo.head()?.resolve()?.peel(ObjectType::Commit)?;
    obj.into_commit()
        .map_err(|_| git2::Error::from_str("Couldn't find commit"))
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

fn get_logs(repo: &Repository) -> Result<Vec<GitLog>, git2::Error> {
    let mut vec: Vec<GitLog> = Vec::new();
    let last_commit = find_last_commit(&repo)?;
    get_commit_log(&repo, &last_commit, &mut vec)?;
    Ok(vec)
}

fn get_commit_log(
    repo: &Repository,
    commit: &Commit,
    vec: &mut Vec<GitLog>,
) -> Result<(), git2::Error> {
    let git_log = GitLog {
        commit_uuid: commit.id().to_string(),
        message: commit.message().unwrap().to_string(),
    };
    vec.push(git_log);
    let parents_count = commit.parent_count();
    if parents_count > 0 {
        let parent_commit = commit.parent(0)?;
        get_commit_log(&repo, &parent_commit, vec)?;
    }
    Ok(())
}
