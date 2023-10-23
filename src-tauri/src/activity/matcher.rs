use std::fmt::{self, Display};

use anyhow::anyhow;
use nom::branch::alt;
use nom::bytes::complete::{escaped, tag, take_until};
use nom::character::complete::one_of;
use nom::combinator::{map_opt, map_res};
use nom::multi::fold_many0;
use nom::sequence::{delimited, pair, preceded, separated_pair};
use regex::Regex;

use super::Activity;

#[derive(Clone, Copy)]
pub enum Field {
    Exe,
    Title,
}

impl Field {
    fn get_from(self, activity: &Activity) -> &str {
        match self {
            Field::Exe => &activity.exe,
            Field::Title => &activity.title,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Field::Exe => "exe",
            Field::Title => "title",
        }
    }
}

pub enum Matcher {
    And(Box<Matcher>, Box<Matcher>),
    Or(Box<Matcher>, Box<Matcher>),
    Eq(Field, String),
    NotEq(Field, String),
    StartsWith(Field, String),
    Contains(Field, String),
    EndsWith(Field, String),
    Matches(Field, Regex),
}

impl Matcher {
    pub fn parse(input: &str) -> anyhow::Result<Self> {
        match expr(input) {
            Ok(("", matcher)) => Ok(matcher),
            Ok((rest, _matcher)) => Err(anyhow!("Incomplete parse: {}", rest)),
            Err(e) => Err(e.to_owned().into()),
        }
    }

    pub fn matches(&self, activity: &Activity) -> bool {
        match self {
            Matcher::And(left, right) => left.matches(activity) && right.matches(activity),
            Matcher::Or(left, right) => left.matches(activity) || right.matches(activity),
            Matcher::Eq(field, token) => field.get_from(activity) == token,
            Matcher::NotEq(field, token) => field.get_from(activity) != token,
            Matcher::StartsWith(field, token) => field.get_from(activity).starts_with(token),
            Matcher::Contains(field, token) => field.get_from(activity).contains(token),
            Matcher::EndsWith(field, token) => field.get_from(activity).ends_with(token),
            Matcher::Matches(field, re) => re.is_match(field.get_from(activity)),
        }
    }
}

impl Display for Matcher {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Matcher::And(left, right) => write!(f, "{} and {}", left, right),
            Matcher::Or(left, right) => write!(f, "{} or {}", left, right),
            Matcher::Eq(field, token) => write!(f, "{} == '{}'", field.name(), token),
            Matcher::NotEq(field, token) => write!(f, "{} != '{}'", field.name(), token),
            Matcher::StartsWith(field, token) => {
                write!(f, "{} starts with '{}'", field.name(), token)
            }
            Matcher::Contains(field, token) => write!(f, "{} contains '{}'", field.name(), token),
            Matcher::EndsWith(field, token) => write!(f, "{} ends with '{}'", field.name(), token),
            Matcher::Matches(field, re) => write!(f, "{} matches '{}'", field.name(), re.as_str()),
        }
    }
}

// Expr ::= Disj
// Disj ::= Conj ('or' Conj)*
// Conj ::= Comp ('and' Comp)*
// Comp ::= Var '==' Term
//        | Var '!=' Term
//        | Var 'starts' 'with' Term
//        | Var 'ends' 'with' Term
//        | Var 'contains' Term
//        | Var 'matches' Term
// Var ::= 'exe' | 'name'
// Term ::= '\'' .* '\''
type Input<'a> = &'a str;
type Parsed<'a, T> = nom::IResult<Input<'a>, T>;

fn space(s: Input) -> Parsed<Input> {
    nom::character::complete::multispace0(s)
}

fn key<'a>(word: Input<'a>) -> impl FnMut(Input<'a>) -> Parsed<Input> {
    preceded(space, tag(word))
}

fn expr(input: Input) -> Parsed<Matcher> {
    disj(input)
}

fn disj(input: Input) -> Parsed<Matcher> {
    let (input, lhs) = conj(input)?;
    let mut lhs = Some(lhs);
    fold_many0(
        preceded(key("or"), conj),
        move || lhs.take().unwrap(),
        |lhs, rhs| Matcher::Or(Box::new(lhs), Box::new(rhs)),
    )(input)
}

fn conj(input: Input) -> Parsed<Matcher> {
    let (input, lhs) = comp(input)?;
    let mut lhs = Some(lhs);
    fold_many0(
        preceded(key("and"), comp),
        move || lhs.take().unwrap(),
        |lhs, rhs| Matcher::And(Box::new(lhs), Box::new(rhs)),
    )(input)
}

fn comp(input: Input) -> Parsed<Matcher> {
    alt((eq, not_eq, starts_with, contains, ends_with, matches))(input)
}

fn eq(input: Input) -> Parsed<Matcher> {
    let (rest, (field, term)) = separated_pair(field, key("=="), term)(input)?;
    Ok((rest, Matcher::Eq(field, term.to_owned())))
}

fn not_eq(input: Input) -> Parsed<Matcher> {
    let (rest, (field, term)) = separated_pair(field, key("!="), term)(input)?;
    Ok((rest, Matcher::NotEq(field, term.to_owned())))
}

fn starts_with(input: Input) -> Parsed<Matcher> {
    let (rest, (field, term)) =
        separated_pair(field, pair(key("starts"), key("with")), term)(input)?;
    Ok((rest, Matcher::StartsWith(field, term.to_owned())))
}

fn ends_with(input: Input) -> Parsed<Matcher> {
    let (rest, (field, term)) = separated_pair(field, pair(key("ends"), key("with")), term)(input)?;
    Ok((rest, Matcher::EndsWith(field, term.to_owned())))
}

fn contains(input: Input) -> Parsed<Matcher> {
    let (rest, (field, term)) = separated_pair(field, key("contains"), term)(input)?;
    Ok((rest, Matcher::Contains(field, term.to_owned())))
}

fn matches(input: Input) -> Parsed<Matcher> {
    let (rest, (field, re)) =
        separated_pair(field, key("matches"), map_res(term, Regex::new))(input)?;
    Ok((rest, Matcher::Matches(field, re)))
}

fn field(input: Input) -> Parsed<Field> {
    map_opt(alt((key("exe"), key("title"))), |field| match field {
        "exe" => Some(Field::Exe),
        "title" => Some(Field::Title),
        _ => None,
    })(input)
}

fn term(input: Input) -> Parsed<Input> {
    delimited(
        key("'"),
        escaped(take_until("'"), '\\', one_of("'")),
        tag("'"),
    )(input)
}

#[cfg(test)]
mod tests {
    use super::Matcher;
    use crate::activity::Activity;

    fn activity_with_title(title: &str) -> Activity {
        Activity {
            pid: 123,
            exe: "TEST_EXE.exe".to_owned(),
            title: title.to_owned(),
        }
    }

    fn activity_with_exe(exe: &str) -> Activity {
        Activity {
            pid: 321,
            exe: exe.to_owned(),
            title: "TEST_TITLE".to_owned(),
        }
    }

    #[test]
    fn exe_eq() {
        let matcher = Matcher::parse("exe == 'kekus.exe'").unwrap();
        assert!(!matcher.matches(&activity_with_title("kekus.exe")));
        assert!(matcher.matches(&activity_with_exe("kekus.exe")));
    }

    #[test]
    fn title_eq() {
        let matcher = Matcher::parse("title == 'kekus'").unwrap();
        assert!(!matcher.matches(&activity_with_exe("kekus")));
        assert!(matcher.matches(&activity_with_title("kekus")));
    }

    #[test]
    fn exe_eq_or_title_eq() {
        let matcher = Matcher::parse("exe == 'kekus.exe' or title == 'kekus'").unwrap();
        assert!(matcher.matches(&activity_with_exe("kekus.exe")));
        assert!(matcher.matches(&activity_with_title("kekus")));
        assert!(!matcher.matches(&activity_with_exe("alloe.exe")));
        assert!(!matcher.matches(&activity_with_title("arbue")));
    }

    #[test]
    fn exe_ends_with() {
        let matcher = Matcher::parse("exe ends with 'firefox.exe'").unwrap();
        assert!(matcher.matches(&activity_with_exe("firefox.exe")));
        assert!(matcher.matches(&activity_with_exe(
            "C:\\Program Files\\firefox\\firefox.exe"
        )));
        assert!(!matcher.matches(&activity_with_exe("C:\\firefox.exe\\actually_a_directory")));
    }
}
