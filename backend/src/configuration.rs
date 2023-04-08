use std::path::PathBuf;

#[derive(serde::Deserialize)]
pub struct Settings {
    pub application_port: u16,
    pub workspaces_path: String,
}

pub fn get_configuration(configuration_file: &PathBuf) -> Result<Settings, config::ConfigError> {
    let configuration_file_name = &configuration_file
        .as_os_str()
        .to_str()
        .unwrap_or_else(|| panic!("Cannot retrieve the configuration file."));
    let settings = config::Config::builder()
        .add_source(config::File::new(
            configuration_file_name,
            config::FileFormat::Yaml,
        ))
        .build()?;
    settings.try_deserialize::<Settings>()
}
