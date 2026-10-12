import { fromDailyList, fromGraphQL } from './calendar.js';

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { contributionCount contributionLevel date weekday } }
      }
    }
  }
}`;

/** Official GitHub GraphQL API. Needs a token (the default GITHUB_TOKEN in Actions works). */
export async function fetchWithToken(user, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'contribution-fx',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: user } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error(`User "${user}" not found`);
  return fromGraphQL(user, calendar);
}

/** Token-free, CORS-enabled community API (https://github.com/grubersjoe/github-contributions-api). */
export async function fetchPublic(user) {
  const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`);
  if (!res.ok) throw new Error(`Could not load contributions for "${user}" (${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json.contributions)) throw new Error(`Unexpected response for "${user}"`);
  return fromDailyList(user, json.contributions);
}

export async function fetchCalendar(user, token) {
  return token ? fetchWithToken(user, token) : fetchPublic(user);
}
