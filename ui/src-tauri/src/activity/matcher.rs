use anyhow::anyhow;
use nom::branch::alt;
use nom::bytes::complete::{escaped, tag, take_until};
use nom::character::complete::one_of;
use nom::combinator::{map_opt, map_res};
use nom::multi::fold_many0;
use nom::sequence::{delimited, pair, preceded, separated_pair};
use regex::Regex;

use super::Activity;

pub type VarGetter = fn(&Activity) -> &str;

fn exe_name(activity: &Activity) -> &str {
    &activity.exe
}

fn title(activity: &Activity) -> &str {
    &activity.title
}

pub enum Matcher {
    And(Box<Matcher>, Box<Matcher>),
    Or(Box<Matcher>, Box<Matcher>),
    Eq(VarGetter, String),
    NotEq(VarGetter, String),
    StartsWith(VarGetter, String),
    Contains(VarGetter, String),
    EndsWith(VarGetter, String),
    Matches(VarGetter, Regex),
}

impl Matcher {
    pub fn matches(&self, activity: &Activity) -> bool {
        match self {
            Matcher::And(left, right) => left.matches(activity) && right.matches(activity),
            Matcher::Or(left, right) => left.matches(activity) || right.matches(activity),
            Matcher::Eq(var, token) => var(activity) == token,
            Matcher::NotEq(var, token) => var(activity) != token,
            Matcher::StartsWith(var, token) => var(activity).starts_with(token),
            Matcher::Contains(var, token) => var(activity).contains(token),
            Matcher::EndsWith(var, token) => var(activity).ends_with(token),
            Matcher::Matches(var, re) => re.is_match(var(activity)),
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
pub fn parse(input: &str) -> anyhow::Result<Matcher> {
    match expr(input) {
        Ok(("", matcher)) => Ok(matcher),
        Ok((rest, _matcher)) => Err(anyhow!("Incomplete parse: {}", rest)),
        Err(e) => Err(e.to_owned().into()),
    }
}

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
    let (rest, (var, term)) = separated_pair(var, key("=="), term)(input)?;
    Ok((rest, Matcher::Eq(var, term.to_owned())))
}

fn not_eq(input: Input) -> Parsed<Matcher> {
    let (rest, (var, term)) = separated_pair(var, key("!="), term)(input)?;
    Ok((rest, Matcher::NotEq(var, term.to_owned())))
}

fn starts_with(input: Input) -> Parsed<Matcher> {
    let (rest, (var, term)) = separated_pair(var, pair(key("starts"), key("with")), term)(input)?;
    Ok((rest, Matcher::StartsWith(var, term.to_owned())))
}

fn ends_with(input: Input) -> Parsed<Matcher> {
    let (rest, (var, term)) = separated_pair(var, pair(key("ends"), key("with")), term)(input)?;
    Ok((rest, Matcher::EndsWith(var, term.to_owned())))
}

fn contains(input: Input) -> Parsed<Matcher> {
    let (rest, (var, term)) = separated_pair(var, key("contains"), term)(input)?;
    Ok((rest, Matcher::Contains(var, term.to_owned())))
}

fn matches(input: Input) -> Parsed<Matcher> {
    let (rest, (var, re)) = separated_pair(var, key("matches"), map_res(term, Regex::new))(input)?;
    Ok((rest, Matcher::Matches(var, re)))
}

fn var(input: Input) -> Parsed<VarGetter> {
    map_opt(alt((key("exe"), key("title"))), |var| match var {
        "exe" => Some(exe_name as VarGetter),
        "title" => Some(title as VarGetter),
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
        let matcher = super::parse("exe == 'kekus.exe'").unwrap();
        assert!(!matcher.matches(&activity_with_title("kekus.exe")));
        assert!(matcher.matches(&activity_with_exe("kekus.exe")));
    }

    #[test]
    fn title_eq() {
        let matcher = super::parse("title == 'kekus'").unwrap();
        assert!(!matcher.matches(&activity_with_exe("kekus")));
        assert!(matcher.matches(&activity_with_title("kekus")));
    }

    #[test]
    fn exe_eq_or_title_eq() {
        let matcher = super::parse("exe == 'kekus.exe' or title == 'kekus'").unwrap();
        assert!(matcher.matches(&activity_with_exe("kekus.exe")));
        assert!(matcher.matches(&activity_with_title("kekus")));
        assert!(!matcher.matches(&activity_with_exe("alloe.exe")));
        assert!(!matcher.matches(&activity_with_title("arbue")));
    }

    #[test]
    fn exe_ends_with() {
        let matcher = super::parse("exe ends with 'firefox.exe'").unwrap();
        assert!(matcher.matches(&activity_with_exe("firefox.exe")));
        assert!(matcher.matches(&activity_with_exe(
            "C:\\Program Files\\firefox\\firefox.exe"
        )));
        assert!(!matcher.matches(&activity_with_exe("C:\\firefox.exe\\actually_a_directory")));
    }
}
