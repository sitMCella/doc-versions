use crate::configuration::Settings;
use crate::routes::{
    create_branches, create_file, create_workspace, delete_file, delete_workspace, get_branch_logs,
    health_check, retrieve_branches, retrieve_file_content, retrieve_files_status,
    retrieve_workspaces, set_current_branch, update_file,
};
use actix_web::dev::Server;
use actix_web::web::ServiceConfig;
use actix_web::{web, App, HttpServer};
use std::fs;
use std::net::TcpListener;
use std::path::Path;

pub fn run(listener: TcpListener, configuration: &Settings) -> Result<Server, std::io::Error> {
    if let Err(e) = create_workspaces_directory(&configuration) {
        return Err(e);
    };

    let workspaces_path = configuration.workspaces_path.clone();
    let server = HttpServer::new(move || App::new().configure(config_app(workspaces_path.clone())))
        .listen(listener)?
        .run();
    Ok(server)
}

fn create_workspaces_directory(configuration: &Settings) -> Result<(), std::io::Error> {
    let path = Path::new(&configuration.workspaces_path);
    if path.exists() {
        return Ok(());
    }
    fs::create_dir_all(path)?;
    return Ok(());
}

fn config_app(workspace_path: String) -> Box<dyn Fn(&mut ServiceConfig)> {
    Box::new(move |cfg: &mut ServiceConfig| {
        cfg.app_data(web::Data::new(workspace_path.clone()))
            .service(web::resource("/health_check").route(web::get().to(health_check)))
            .service(web::resource("/workspaces").route(web::get().to(retrieve_workspaces)))
            .service(
                web::resource("/workspaces/{workspace_name}")
                    .route(web::post().to(create_workspace))
                    .route(web::delete().to(delete_workspace)),
            )
            .service(
                web::resource("/workspaces/{workspace_name}/branches")
                    .route(web::get().to(retrieve_branches)),
            )
            .service(
                web::resource("/workspaces/{workspace_name}/branches/{branch_name}")
                    .route(web::post().to(create_branches))
                    .route(web::put().to(set_current_branch)),
            )
            .service(
                web::resource("/workspaces/{workspace_name}/branches/{branch_name}/logs")
                    .route(web::get().to(get_branch_logs)),
            )
            .service(
                web::resource("/workspaces/{workspace_name}/branches/{branch_name}/files")
                    .route(web::get().to(retrieve_files_status)),
            )
            .service(
                web::resource(
                    "/workspaces/{workspace_name}/branches/{branch_name}/files/{file_name}",
                )
                .route(web::get().to(retrieve_file_content))
                .route(web::post().to(create_file))
                .route(web::put().to(update_file))
                .route(web::delete().to(delete_file)),
            );
    })
}
