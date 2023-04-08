use actix_web::{web, HttpResponse};
use git2::{Commit, IndexAddOption, ObjectType, Repository, Signature};
use std::{fs, path::PathBuf};

// curl -X GET -v http://127.0.0.1:8000/workspaces
pub async fn retrieve_workspaces(workspace_path: web::Data<String>) -> HttpResponse {
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let mut vec: Vec<String> = Vec::new();
    match fs::read_dir(workspace_directory) {
        Ok(a) => a
            .map(|res| res.map(|e| e.path()))
            .filter_map(Result::ok)
            .filter(|f| f.is_dir())
            .for_each(|f| match f.file_name() {
                Some(n) => {
                    let p = n.clone().to_owned();
                    vec.push(p.into_string().unwrap());
                }
                None => {}
            }),
        Err(_) => return HttpResponse::InternalServerError().finish(),
    };
    HttpResponse::Ok().json(vec)
}

// curl -X POST -v http://127.0.0.1:8000/workspaces/{workspace_name}
pub async fn create_workspace(
    workspace_name_param: web::Path<String>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = workspace_name_param.into_inner();
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace = get_workspace(&workspace_name, &workspace_directory);

    if workspace.exists() {
        return HttpResponse::Conflict().finish();
    }

    let repository = match create_git_repository(&workspace) {
        Ok(r) => r,
        Err(e) => {
            println!("Error while retrieving the repository: {:#?}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    if let Err(e) = create_master_branch(repository, &workspace) {
        eprintln!("Error while creating the master branch: {:#?}", e);
        return HttpResponse::InternalServerError().finish();
    }

    HttpResponse::Ok().finish()
}

// curl -X DELETE -v http://127.0.0.1:8000/workspaces/{workspace_name}
pub async fn delete_workspace(
    workspace_name_param: web::Path<String>,
    workspace_path: web::Data<String>,
) -> HttpResponse {
    let workspace_name = workspace_name_param.into_inner();
    let workspace_directory = PathBuf::from(&workspace_path.as_str());
    let workspace = get_workspace(&workspace_name, &workspace_directory);

    if !workspace.exists() {
        return HttpResponse::NotFound().finish();
    }

    if let Err(e) = fs::remove_dir_all(workspace.as_path()) {
        println!("Error while deleting the repository: {:#?}", e);
        return HttpResponse::InternalServerError().finish();
    }

    HttpResponse::Ok().finish()
}

fn get_workspace(workspace_name: &String, workspace_directory: &PathBuf) -> PathBuf {
    let mut workspace = PathBuf::from(&workspace_directory);
    workspace.push(&workspace_name);
    workspace
}

fn create_git_repository(workspace: &PathBuf) -> Result<Repository, Box<dyn std::error::Error>> {
    if workspace.exists() {
        return get_repository(&workspace);
    };
    match Repository::init(&workspace) {
        Ok(r) => Ok(r),
        Err(e) => Err(Box::new(e)),
    }
}

fn get_repository(workspace: &PathBuf) -> Result<Repository, Box<dyn std::error::Error>> {
    let workspace_path = workspace.to_str().unwrap();
    match Repository::open(&workspace_path) {
        Ok(r) => Ok(r),
        Err(e) => Err(Box::new(e)),
    }
}

fn create_master_branch(repository: Repository, workspace: &PathBuf) -> Result<(), git2::Error> {
    create_first_commit(&repository)?;
    if let Err(e) = copy_file(&workspace) {
        eprintln!("Error while creating the README.md file: {:#?}", e);
    }
    let first_commit = find_last_commit(&repository)?;
    create_second_commit(&repository, &first_commit)?;
    let (object, reference) = repository.revparse_ext("master")?;
    match reference {
        Some(gref) => repository.set_head(gref.name().unwrap())?,
        None => repository.set_head_detached(object.id())?,
    };
    Ok(())
}

fn copy_file(workspace_directory: &PathBuf) -> std::io::Result<u64> {
    let mut file_path = workspace_directory.clone();
    file_path.push("README.md");
    std::fs::copy("worspace_README.md", &file_path)
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
        "Initial commit",
        &tree,
        &[],
    )
}

fn find_last_commit(repo: &Repository) -> Result<Commit, git2::Error> {
    let obj = repo.head()?.resolve()?.peel(ObjectType::Commit)?;
    obj.into_commit()
        .map_err(|_| git2::Error::from_str("Couldn't find commit"))
}

fn create_second_commit(
    repository: &Repository,
    first_commit: &Commit,
) -> Result<git2::Oid, git2::Error> {
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
        "Second commit",
        &tree,
        &[first_commit],
    )
}
