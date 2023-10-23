use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::activity::{Activity, Matcher};

#[derive(Default, Serialize, Deserialize)]
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

#[derive(Serialize, Deserialize)]
pub struct Tag {
    name: String,

    #[serde(
        serialize_with = "serialize_matcher",
        deserialize_with = "deserialize_matcher"
    )]
    matcher: Matcher,
}

fn deserialize_matcher<'de, D>(deserializer: D) -> Result<Matcher, D::Error>
where
    D: Deserializer<'de>,
{
    let buf = std::borrow::Cow::<str>::deserialize(deserializer)?;
    Matcher::parse(&buf).map_err(serde::de::Error::custom)
}

// fn<S>(&T, S) -> Result<S::Ok, S::Error> where S: Serializer
fn serialize_matcher<S>(matcher: &Matcher, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let m = matcher.to_string();
    serializer.serialize_str(&m)
}
