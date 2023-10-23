use std::collections::HashSet;

use serde::{Serialize, Deserialize};

use crate::tagger::Tagger;

#[derive(Serialize, Deserialize, Clone)]
pub struct StorageDescription {
    pub location: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Config {
    pub storage: StorageDescription,
    pub blacklist: HashSet<String>,

    #[serde(flatten)]
    pub tagger: Tagger,
}
