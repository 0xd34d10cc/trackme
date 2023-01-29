use serde::{Deserialize, Deserializer};

use crate::activity::{Activity, Matcher};

#[derive(Default, Deserialize)]
pub struct Tagger {
    matchers: Vec<Tag>,
}

impl Tagger {
    pub fn tag(&self, activity: &Activity) -> Option<&str> {
        for tag in &self.matchers {
            if tag.matcher.matches(activity) {
                return Some(&tag.name);
            }
        }

        None
    }
}

#[derive(Deserialize)]
pub struct Tag {
    name: String,
    #[serde(deserialize_with = "deserialize_matcher")]
    matcher: Matcher,
}

fn deserialize_matcher<'de, D>(deserializer: D) -> Result<Matcher, D::Error>
where
    D: Deserializer<'de>,
{
    let buf = std::borrow::Cow::<str>::deserialize(deserializer)?;
    Matcher::parse(&buf).map_err(serde::de::Error::custom)
}
