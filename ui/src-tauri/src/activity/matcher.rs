use anyhow::anyhow;
use nom::branch::alt;
use nom::bytes::complete::{escaped, tag, take_until};
use nom::character::complete::one_of;
use nom::combinator::{map_opt, map_res};
use nom::multi::fold_many0;
use nom::sequence::{delimited, pair, preceded, separated_pair};
use predicates::function::function;
use predicates::prelude::{Predicate, PredicateBooleanExt, PredicateBoxExt};
use predicates::str::RegexPredicate;

use super::Activity;

type InnerMatcher = predicates::BoxPredicate<Activity>;

pub struct Matcher {
    inner: InnerMatcher
}

impl Matcher {
    pub fn matches(&self, activity: &Activity) -> bool {
        self.inner.eval(activity)
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
        Ok(("", inner)) => Ok(Matcher { inner }),
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

fn expr(input: Input) -> Parsed<InnerMatcher> {
    disj(input)
}

fn disj(input: Input) -> Parsed<InnerMatcher> {
    let (input, lhs) = conj(input)?;
    let mut lhs = Some(lhs);
    fold_many0(
        preceded(key("or"), conj),
        move || lhs.take().unwrap(),
        |lhs, rhs| lhs.or(rhs).boxed(),
    )(input)
}

fn conj(input: Input) -> Parsed<InnerMatcher> {
    let (input, lhs) = comp(input)?;
    let mut lhs = Some(lhs);
    fold_many0(
        preceded(key("and"), comp),
        move || lhs.take().unwrap(),
        |lhs, rhs| lhs.or(rhs).boxed(),
    )(input)
}

fn comp(input: Input) -> Parsed<InnerMatcher> {
    alt((eq, not_eq, starts_with, contains, ends_with, matches))(input)
}

fn eq(input: Input) -> Parsed<InnerMatcher> {
    let (rest, (var, term)) = separated_pair(var, key("=="), term)(input)?;
    let term = term.to_owned();
    let matcher = function(move |activity| var(activity) == term);
    Ok((rest, matcher.boxed()))
}

fn not_eq(input: Input) -> Parsed<InnerMatcher> {
    let (rest, (var, term)) = separated_pair(var, key("!="), term)(input)?;
    let term = term.to_owned();
    let matcher = function(move |activity| var(activity) != term);
    Ok((rest, matcher.boxed()))
}

fn starts_with(input: Input) -> Parsed<InnerMatcher> {
    let (rest, (var, term)) = separated_pair(var, pair(key("starts"), key("with")), term)(input)?;
    let term = term.to_owned();
    let matcher = function(move |activity| var(activity).starts_with(&term));
    Ok((rest, matcher.boxed()))
}

fn ends_with(input: Input) -> Parsed<InnerMatcher> {
    let (rest, (var, term)) = separated_pair(var, pair(key("ends"), key("with")), term)(input)?;
    let term = term.to_owned();
    let matcher = function(move |activity| var(activity).ends_with(&term));
    Ok((rest, matcher.boxed()))
}

fn contains(input: Input) -> Parsed<InnerMatcher> {
    let (rest, (var, term)) = separated_pair(var, key("contains"), term)(input)?;
    let term = term.to_owned();
    let matcher = function(move |activity| var(activity).contains(&term));
    Ok((rest, matcher.boxed()))
}

fn regex(input: Input) -> Parsed<RegexPredicate> {
    map_res(term, |re| predicates::str::is_match(re))(input)
}

fn matches(input: Input) -> Parsed<InnerMatcher> {
    let (rest, (var, re)) = separated_pair(var, key("matches"), regex)(input)?;
    let matcher = function(move |activity| re.eval(var(activity)));
    Ok((rest, matcher.boxed()))
}

type VarGetter = fn(&Activity) -> &str;

fn exe_name(activity: &Activity) -> &str {
    &activity.exe
}

fn title(activity: &Activity) -> &str {
    &activity.title
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
        assert!(matcher.matches(&activity_with_exe("C:\\Program Files\\firefox\\firefox.exe")));
        assert!(!matcher.matches(&activity_with_exe("C:\\firefox.exe\\actually_a_directory")));
    }
}
