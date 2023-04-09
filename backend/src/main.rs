use docversions::configuration::get_configuration;
use docversions::startup::run;
use std::net::TcpListener;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let configuration_file_name = PathBuf::from("configuration.yaml");
    let configuration =
        get_configuration(&configuration_file_name).expect("Failed to read configuration.");
    println!("{}", &configuration.workspaces_path);

    let address = format!("0.0.0.0:{}", configuration.application_port);
    let listener = TcpListener::bind(address).expect("Failed to bind port");
    run(listener, &configuration)?.await
}
