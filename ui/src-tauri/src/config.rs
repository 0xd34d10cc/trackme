use std::collections::HashSet;

use serde::Deserialize;

use crate::tagger::Tagger;

#[derive(Default, Deserialize)]
pub struct Config {
    pub blacklist: HashSet<String>,
    #[serde(flatten)]
    pub tagger: Tagger,
}
