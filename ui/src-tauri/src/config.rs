use std::collections::HashSet;

use serde::Deserialize;

use crate::tagger::Tagger;

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageKind {
    Csv,
    Sqlite
}

#[derive(Deserialize)]
pub struct StorageDescription {
    pub location: Option<String>,
    pub kind: StorageKind,
}

#[derive(Deserialize)]
pub struct Config {
    pub storage: StorageDescription,
    pub blacklist: HashSet<String>,
    #[serde(flatten)]
    pub tagger: Tagger,
}
